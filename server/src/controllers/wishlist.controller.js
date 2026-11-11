import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';
import { findOrCreateCart } from './cart.controller.js';

const FIELDS = 'name slug brand price mrp stock images ratingAvg numReviews isActive';

/** Loads the wishlist with live product data, hiding products since removed. */
const buildWishlist = async (userId) => {
  const list = await Wishlist.findOne({ user: userId }).populate('products', FIELDS);
  const products = (list?.products || []).filter((p) => p && p.isActive);
  return { products, count: products.length };
};

/** @route GET /api/wishlist  @access Private */
export const getWishlist = async (req, res) => {
  res.status(200).json({ success: true, wishlist: await buildWishlist(req.user.id) });
};

/** @route POST /api/wishlist/:productId  @access Private */
export const addToWishlist = async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // upsert + $addToSet: creates the list on first use and never duplicates.
  await Wishlist.findOneAndUpdate(
    { user: req.user.id },
    { $addToSet: { products: product._id } },
    { upsert: true }
  );

  res.status(200).json({ success: true, wishlist: await buildWishlist(req.user.id) });
};

/** @route DELETE /api/wishlist/:productId  @access Private */
export const removeFromWishlist = async (req, res) => {
  await Wishlist.updateOne({ user: req.user.id }, { $pull: { products: req.params.productId } });
  res.status(200).json({ success: true, wishlist: await buildWishlist(req.user.id) });
};

/**
 * @route POST /api/wishlist/:productId/move-to-cart  @access Private
 * Adds one unit to the cart, then removes it from the wishlist.
 */
export const moveToCart = async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const cart = await findOrCreateCart(req.user.id);
  const existing = cart.items.find((i) => i.product.toString() === product._id.toString());
  const wanted = (existing?.quantity ?? 0) + 1;

  if (wanted > product.stock) {
    return res.status(409).json({
      success: false,
      message: product.stock === 0 ? 'This item is out of stock' : `Only ${product.stock} in stock`,
    });
  }

  if (existing) existing.quantity = wanted;
  else cart.items.push({ product: product._id, quantity: 1 });
  await cart.save();

  await Wishlist.updateOne({ user: req.user.id }, { $pull: { products: product._id } });

  res.status(200).json({ success: true, wishlist: await buildWishlist(req.user.id) });
};
