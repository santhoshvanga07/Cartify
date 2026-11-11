import Order from '../models/Order.js';
import { notifyPaymentReceived } from '../services/notification.service.js';
import { getSettings } from '../services/settings.service.js';
import {
  isRazorpayConfigured, startPayment, verifyRazorpaySignature, refundRazorpayPayment,
} from '../services/payment.service.js';
import { razorpayAttempts } from './order.controller.js';

/** Only an online order that is still open and not yet paid can take a payment. */
const isAwaitingPayment = (order) =>
  order.paymentMethod === 'razorpay'
  && ['pending', 'failed'].includes(order.paymentStatus)
  && ['placed', 'confirmed'].includes(order.status);

/** @route GET /api/payments/config  @access Public */
export const paymentConfig = (req, res) => {
  const online = isRazorpayConfigured() && getSettings().onlinePaymentEnabled;
  res.status(200).json({
    success: true,
    razorpay: online,
    cod: getSettings().codEnabled,
    // The key ID is public by design - it goes into the browser's checkout
    // widget. The SECRET never leaves the server.
    keyId: online ? process.env.RAZORPAY_KEY_ID : null,
  });
};

/** Loads an order the signed-in user owns (and optionally insists it is still waiting for payment). */
const loadOwnOrder = async (req, res, { mustBePayable = true } = {}) => {
  const order = await Order.findById(req.params.orderId).populate('user', 'name email');
  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return null;
  }
  if (order.user._id.toString() !== req.user.id.toString()) {
    res.status(403).json({ success: false, message: 'Not your order' });
    return null;
  }
  if (mustBePayable && !isAwaitingPayment(order)) {
    res.status(409).json({ success: false, message: 'This order is not awaiting payment' });
    return null;
  }
  return order;
};

/**
 * @route POST /api/payments/:orderId/retry  @access Private (own order)
 * The shopper closed the payment window, or the card was declined. A fresh
 * Razorpay order lets them try again without re-doing checkout.
 */
export const retryPayment = async (req, res) => {
  if (!isRazorpayConfigured()) {
    return res.status(503).json({ success: false, message: 'Online payment is not enabled' });
  }
  const order = await loadOwnOrder(req, res);
  if (!order) return;

  res.status(200).json({ success: true, razorpay: await startPayment(order) });
};

/**
 * @route POST /api/payments/:orderId/verify  @access Private (own order)
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export const verifyPayment = async (req, res) => {
  const order = await loadOwnOrder(req, res, { mustBePayable: false });
  if (!order) return;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  // The payment must be for a Razorpay order WE created for THIS order (any
  // attempt - an older checkout window can still be completed after a retry).
  // Otherwise a cheap order's valid signature could pay for an expensive one.
  if (!razorpayAttempts(order).includes(razorpay_order_id)) {
    return res.status(400).json({ success: false, message: 'Payment does not match this order' });
  }

  const valid = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    if (isAwaitingPayment(order)) {
      order.paymentStatus = 'failed';
      order.statusHistory.push({ status: order.status, note: 'Payment verification failed' });
      await order.save();
    }
    return res.status(400).json({ success: false, message: 'Payment could not be verified' });
  }

  // The same payment reported twice (double click, retried request): already done.
  if (order.paymentStatus === 'paid' && order.paymentDetails.razorpayPaymentId === razorpay_payment_id) {
    return res.status(200).json({ success: true, order });
  }

  /**
   * Real money arrived, but the order can no longer take it: it was
   * cancelled (perhaps automatically, for taking too long) or it was already
   * paid by another attempt. Keeping the money would be wrong - refund it.
   */
  if (!isAwaitingPayment(order)) {
    const refundId = await refundRazorpayPayment(razorpay_payment_id, order.pricing.total);
    order.statusHistory.push({
      status: order.status,
      note: refundId
        ? `Late payment ${razorpay_payment_id} refunded (${refundId})`
        : `Late payment ${razorpay_payment_id} received - automatic refund failed, refund manually`,
    });
    await order.save();
    return res.status(409).json({
      success: false,
      message: order.status === 'cancelled'
        ? 'This order was cancelled before your payment arrived. The payment is being refunded.'
        : 'This order was already paid. Your extra payment is being refunded.',
      order,
    });
  }

  order.paymentStatus = 'paid';
  order.paymentDetails.razorpayPaymentId = razorpay_payment_id;
  order.paymentDetails.razorpaySignature = razorpay_signature;
  order.paymentDetails.paidAt = new Date();
  order.statusHistory.push({ status: order.status, note: `Paid online (${razorpay_payment_id})` });
  await order.save();
  notifyPaymentReceived(order, order.user);

  res.status(200).json({ success: true, order });
};
