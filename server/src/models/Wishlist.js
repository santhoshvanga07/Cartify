import mongoose from 'mongoose';

/**
 * One wishlist per user - the same shape as the cart, minus quantities.
 * References only: a saved item should show today's price, not the price on
 * the day it was saved.
 */
const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

export default mongoose.model('Wishlist', wishlistSchema);
