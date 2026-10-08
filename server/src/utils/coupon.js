import Coupon from '../models/Coupon.js';

/** Rounds to 2 decimals - same rule as pricing.js. */
const money = (n) => Math.round(n * 100) / 100;
const rupees = (n) => `₹${money(n).toLocaleString('en-IN')}`;

export class CouponError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

/**
 * Looks up a coupon and works out what it is worth against this subtotal.
 *
 * Every rule is checked on the SERVER, at checkout, again - the discount the
 * customer saw on the checkout page is only a preview. A coupon may have
 * expired or run out between previewing it and placing the order.
 *
 * @returns {{ coupon, discount }} or throws CouponError with a shopper-friendly reason
 */
export const evaluateCoupon = async (rawCode, subtotal, userId) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) throw new CouponError('Enter a coupon code');

  const coupon = await Coupon.findOne({ code, isActive: true }).select('+usedBy');
  if (!coupon) throw new CouponError('That coupon code is not valid');

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CouponError('This coupon has expired');
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponError('This coupon has been fully redeemed');
  }
  if (userId && coupon.usedBy.some((id) => id.toString() === userId.toString())) {
    throw new CouponError('You have already used this coupon');
  }
  if (subtotal < coupon.minOrder) {
    throw new CouponError(`Add items worth ${rupees(coupon.minOrder - subtotal)} more to use this coupon`);
  }

  let discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);

  return { coupon, discount: money(Math.min(discount, subtotal)) };
};

/**
 * Marks a coupon as used by this customer.
 *
 * A single conditional update: it only matches while the coupon still has
 * uses left AND this user is not yet in usedBy. Two simultaneous checkouts
 * cannot both take the last use - the database decides, not a read-then-write.
 *
 * @returns {boolean} false when the coupon could not be redeemed
 */
export const redeemCoupon = async (couponId, userId) => {
  const result = await Coupon.updateOne(
    {
      _id: couponId,
      usedBy: { $ne: userId },
      $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    },
    { $inc: { usedCount: 1 }, $addToSet: { usedBy: userId } }
  );
  return result.modifiedCount === 1;
};

/** Gives a use back - for an order that failed after the coupon was taken. */
export const releaseCoupon = async (couponId, userId) => {
  await Coupon.updateOne(
    { _id: couponId, usedBy: userId },
    { $inc: { usedCount: -1 }, $pull: { usedBy: userId } }
  );
};
