import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    rating: {
      type: Number,
      required: [true, 'A rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
    },
    title: { type: String, trim: true, maxlength: 100, default: '' },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },

    images: [{ url: String, publicId: String }],

    /**
     * Set automatically by checking whether this user has a DELIVERED order
     * containing this product. We badge rather than block: anyone signed in
     * may review, but only real buyers get the badge - which is how shoppers
     * judge whether to trust it.
     */
    isVerifiedPurchase: { type: Boolean, default: false },

    /**
     * Stored as user ids, not a counter. A number could be incremented
     * endlessly by the same person; an array makes "one vote per user"
     * a property of the data instead of a rule we have to remember.
     */
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    reports: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, maxlength: 200 },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    // Admins hide abusive reviews rather than deleting them, so the audit
    // trail survives and the author cannot simply repost.
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * One review per user per product, enforced by the DATABASE.
 * A controller check alone would lose a race between two simultaneous
 * requests; a unique index cannot.
 */
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

/**
 * Recomputes the product's ratingAvg and numReviews.
 *
 * Product stores these DENORMALISED - copied out of the reviews - so that
 * listing 24 products does not mean running 24 aggregations. We pay a small
 * cost on write (rare) to make reads (constant) cheap.
 *
 * A static lives on the model itself, not on a document, because we call it
 * after a review is deleted, when there is no document left to call it on.
 */
reviewSchema.statics.recalculateProductRating = async function (productId) {
  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), isApproved: true } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await mongoose.model('Product').findByIdAndUpdate(productId, {
    ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
    numReviews: stats ? stats.count : 0,
  });

  return stats ?? { avg: 0, count: 0 };
};

export default mongoose.model('Review', reviewSchema);
