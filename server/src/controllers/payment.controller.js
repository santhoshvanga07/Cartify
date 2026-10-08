import Order from '../models/Order.js';
import { notifyPaymentReceived } from '../services/notification.service.js';
import {
  isRazorpayConfigured, startPayment, verifyRazorpaySignature,
} from '../services/payment.service.js';

/** @route GET /api/payments/config  @access Public */
export const paymentConfig = (req, res) => {
  res.status(200).json({
    success: true,
    razorpay: isRazorpayConfigured(),
    // The key ID is public by design - it goes into the browser's checkout
    // widget. The SECRET never leaves the server.
    keyId: isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : null,
  });
};

/** Loads an order the signed-in user owns that is still waiting for online payment. */
const loadPayableOrder = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return null;
  }
  if (order.user.toString() !== req.user.id.toString()) {
    res.status(403).json({ success: false, message: 'Not your order' });
    return null;
  }
  if (order.paymentMethod !== 'razorpay' || order.paymentStatus === 'paid' || order.status === 'cancelled') {
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
  const order = await loadPayableOrder(req, res);
  if (!order) return;

  res.status(200).json({ success: true, razorpay: await startPayment(order) });
};

/**
 * @route POST /api/payments/:orderId/verify  @access Private (own order)
 * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export const verifyPayment = async (req, res) => {
  const order = await loadPayableOrder(req, res);
  if (!order) return;

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // The payment must be for the Razorpay order WE created for THIS order.
  // Otherwise a cheap order's valid signature could pay for an expensive one.
  if (razorpay_order_id !== order.paymentDetails.razorpayOrderId) {
    return res.status(400).json({ success: false, message: 'Payment does not match this order' });
  }

  const valid = verifyRazorpaySignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!valid) {
    order.paymentStatus = 'failed';
    order.statusHistory.push({ status: order.status, note: 'Payment verification failed' });
    await order.save();
    return res.status(400).json({ success: false, message: 'Payment could not be verified' });
  }

  order.paymentStatus = 'paid';
  order.paymentDetails.razorpayPaymentId = razorpay_payment_id;
  order.paymentDetails.razorpaySignature = razorpay_signature;
  order.paymentDetails.paidAt = new Date();
  order.statusHistory.push({ status: order.status, note: `Paid online (${razorpay_payment_id})` });
  await order.save();
  notifyPaymentReceived(order, req.user);

  res.status(200).json({ success: true, order });
};
