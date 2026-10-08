import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { logActivity } from '../services/activity.service.js';

/** Has this user actually received this product? */
const hasPurchased = async (userId, productId) =>
  Boolean(
    await Order.exists({
      user: userId,
      status: 'delivered',
      'items.product': productId,
    })
  );

/**
 * @route GET /api/products/:slug/reviews
 * @access Public
 */
export const listReviews = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const sort = req.query.sort === 'helpful' ? { helpfulVotes: -1 } : { createdAt: -1 };

  const reviews = await Review.find({ product: product._id, isApproved: true })
    .populate('user', 'name')
    .sort(sort);

  // Rating distribution for the 5/4/3/2/1 bars.
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  res.status(200).json({
    success: true,
    count: reviews.length,
    ratingAvg: product.ratingAvg,
    breakdown,
    // Hide reporter identities from the public payload; send only what the UI needs.
    reviews: reviews.map((r) => ({
      _id: r._id,
      user: r.user,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      images: r.images,
      isVerifiedPurchase: r.isVerifiedPurchase,
      helpfulCount: r.helpfulVotes.length,
      votedByMe: req.user ? r.helpfulVotes.some((id) => id.equals(req.user._id)) : false,
      isMine: req.user ? r.user._id.equals(req.user._id) : false,
      createdAt: r.createdAt,
    })),
  });
};

/**
 * @route POST /api/products/:slug/reviews
 * @access Private
 */
export const createReview = async (req, res) => {
  const { rating, title, comment } = req.body;

  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  if (await Review.exists({ product: product._id, user: req.user.id })) {
    return res.status(409).json({
      success: false,
      message: 'You have already reviewed this product - edit your existing review instead',
    });
  }

  const review = await Review.create({
    product: product._id,
    user: req.user.id,
    rating,
    title,
    comment,
    isVerifiedPurchase: await hasPurchased(req.user.id, product._id),
  });

  await Review.recalculateProductRating(product._id);
  await review.populate('user', 'name');

  res.status(201).json({ success: true, review });
};

/**
 * @route PUT /api/reviews/:id
 * @access Private (own review)
 */
export const updateReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

  if (!review.user.equals(req.user._id)) {
    return res.status(403).json({ success: false, message: 'You can only edit your own review' });
  }

  const { rating, title, comment } = req.body;
  if (rating != null) review.rating = rating;
  if (title != null) review.title = title;
  if (comment != null) review.comment = comment;

  await review.save();
  await Review.recalculateProductRating(review.product);

  res.status(200).json({ success: true, review });
};

/**
 * @route DELETE /api/reviews/:id
 * @access Private (own review) or Admin
 */
export const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

  const isOwner = review.user.equals(req.user._id);
  const isStaff = ['admin', 'superadmin'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    return res.status(403).json({ success: false, message: 'Not your review' });
  }

  const productId = review.product;
  await review.deleteOne();
  if (!isOwner) logActivity(req, 'review.delete', { type: 'review', id: review._id, label: review.title || review.comment.slice(0, 40) });
  await Review.recalculateProductRating(productId);

  res.status(200).json({ success: true, message: 'Review deleted' });
};

/**
 * @route POST /api/reviews/:id/helpful
 * @access Private
 * Toggles the vote - clicking again takes it back.
 */
export const toggleHelpful = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

  if (review.user.equals(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot vote on your own review' });
  }

  const index = review.helpfulVotes.findIndex((id) => id.equals(req.user._id));
  if (index === -1) review.helpfulVotes.push(req.user._id);
  else review.helpfulVotes.splice(index, 1);

  await review.save();

  res.status(200).json({
    success: true,
    helpfulCount: review.helpfulVotes.length,
    votedByMe: index === -1,
  });
};

/**
 * @route POST /api/reviews/:id/report
 * @access Private
 */
export const reportReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

  if (review.reports.some((r) => r.user?.equals(req.user._id))) {
    return res.status(409).json({ success: false, message: 'You have already reported this review' });
  }

  review.reports.push({ user: req.user.id, reason: String(req.body.reason || '').slice(0, 200) });

  // Auto-hide after enough independent reports, so abuse does not stay visible
  // until an admin happens to log in. An admin can still restore it.
  if (review.reports.length >= 3) review.isApproved = false;

  await review.save();
  if (!review.isApproved) await Review.recalculateProductRating(review.product);

  res.status(200).json({ success: true, message: 'Thank you - our team will take a look' });
};

/**
 * @route GET /api/reviews/reported
 * @access Admin - the moderation queue
 */
export const listReportedReviews = async (req, res) => {
  const reviews = await Review.find({ 'reports.0': { $exists: true } })
    .populate('user', 'name email')
    .populate('product', 'name slug')
    .sort({ 'reports.length': -1, updatedAt: -1 });

  res.status(200).json({ success: true, count: reviews.length, reviews });
};

/**
 * @route PATCH /api/reviews/:id/approve
 * @access Admin
 */
export const setApproval = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

  review.isApproved = Boolean(req.body.isApproved);
  if (review.isApproved) review.reports = []; // cleared once a human has judged it
  await review.save();
  logActivity(req, review.isApproved ? 'review.restore' : 'review.hide', {
    type: 'review', id: review._id, label: review.title || review.comment.slice(0, 40),
  });
  await Review.recalculateProductRating(review.product);

  res.status(200).json({
    success: true,
    message: review.isApproved ? 'Review restored' : 'Review hidden',
    review,
  });
};
