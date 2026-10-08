import Coupon from '../models/Coupon.js';
import Cart from '../models/Cart.js';
import { calculateTotals } from '../utils/pricing.js';
import { evaluateCoupon } from '../utils/coupon.js';
import { logActivity } from '../services/activity.service.js';

// Fields an admin may set. Anything else in the body (usedCount, usedBy) is ignored.
const EDITABLE = [
  'code', 'description', 'type', 'value', 'maxDiscount', 'minOrder', 'expiresAt', 'usageLimit', 'isActive',
];
const pick = (body) =>
  Object.fromEntries(EDITABLE.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

/** @route GET /api/coupons  @access Admin */
export const listCoupons = async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: coupons.length, coupons });
};

/** @route POST /api/coupons  @access Admin */
export const createCoupon = async (req, res) => {
  const coupon = await Coupon.create(pick(req.body));
  logActivity(req, 'coupon.create', { type: 'coupon', id: coupon._id, label: coupon.code });
  res.status(201).json({ success: true, coupon });
};

/** @route PUT /api/coupons/:id  @access Admin */
export const updateCoupon = async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

  Object.assign(coupon, pick(req.body));
  await coupon.save();
  logActivity(req, 'coupon.update', { type: 'coupon', id: coupon._id, label: coupon.code }, Object.keys(pick(req.body)).join(', '));
  res.status(200).json({ success: true, coupon });
};

/** @route DELETE /api/coupons/:id  @access Admin */
export const deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
  logActivity(req, 'coupon.delete', { type: 'coupon', id: coupon._id, label: coupon.code });
  res.status(200).json({ success: true, message: 'Coupon deleted' });
};

/**
 * @route POST /api/coupons/apply   body: { code }
 * @access Private
 *
 * A PREVIEW for the checkout page: what would this coupon do to my bag?
 * Nothing is redeemed here - that happens only when the order is placed.
 */
export const applyCoupon = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product', 'price isActive');
  const lines = (cart?.items || [])
    .filter((i) => i.product && i.product.isActive)
    .map((i) => ({ price: i.product.price, quantity: i.quantity }));

  if (lines.length === 0) {
    return res.status(400).json({ success: false, message: 'Your bag is empty' });
  }

  const { subtotal } = calculateTotals(lines);
  const { coupon, discount } = await evaluateCoupon(req.body.code, subtotal, req.user.id);

  res.status(200).json({
    success: true,
    coupon: { code: coupon.code, description: coupon.description, discount },
    totals: calculateTotals(lines, { discount }),
  });
};
