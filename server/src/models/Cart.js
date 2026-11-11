import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    // A REFERENCE, not a copy. Prices are read live from the product.
    // (Orders do the opposite - they snapshot the price. See Order.js)
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // The chosen size/colour label, or '' for products without options.
    variant: { type: String, default: '', maxlength: 30 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    // unique: one cart per user, enforced by the database
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Cart', cartSchema);
