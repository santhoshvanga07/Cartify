import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    // Stored upper-case so "save10" and "SAVE10" are the same coupon.
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{3,20}$/, 'Code must be 3-20 letters, digits, - or _'],
    },
    description: { type: String, trim: true, maxlength: 200, default: '' },

    type: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: [1, 'Value must be at least 1'] },

    // A percentage coupon without a cap can discount a ₹2 lakh laptop by
    // ₹40,000. maxDiscount is the ceiling; 0 means "no cap".
    maxDiscount: { type: Number, default: 0, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },

    expiresAt: { type: Date },

    // 0 means unlimited. usedCount is incremented atomically at checkout.
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },

    // One use per customer. An array of ids makes that a property of the data.
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false }],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.path('value').validate(function (v) {
  return this.type !== 'percent' || v <= 90;
}, 'A percentage coupon cannot exceed 90%');

export default mongoose.model('Coupon', couponSchema);
