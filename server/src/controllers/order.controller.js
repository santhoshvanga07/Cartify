import mongoose from 'mongoose';
import Order, { ALLOWED_TRANSITIONS } from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { calculateTotals } from '../utils/pricing.js';
import {
  isRazorpayConfigured, startPayment, refundRazorpayPayment,
} from '../services/payment.service.js';
import { evaluateCoupon, redeemCoupon, releaseCoupon } from '../utils/coupon.js';

/**
 * @route POST /api/orders
 * @access Private
 * body: { shippingAddress, paymentMethod, couponCode? }
 *
 * THE RULE OF CHECKOUT: nothing about money or stock comes from the client.
 * The browser sends an address and a payment method. Everything else - which
 * items, at what price, totalling what - is read from the database here.
 */
export const createOrder = async (req, res) => {
  const { shippingAddress, paymentMethod = 'cod', couponCode } = req.body;

  if (!['cod', 'razorpay'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  }
  if (paymentMethod === 'razorpay' && !isRazorpayConfigured()) {
    return res.status(400).json({ success: false, message: 'Online payment is not enabled' });
  }

  const required = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'];
  const missing = required.filter((f) => !shippingAddress?.[f]?.trim());
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing address fields: ${missing.join(', ')}` });
  }
  if (!/^\d{6}$/.test(shippingAddress.pincode)) {
    return res.status(400).json({ success: false, message: 'Pincode must be 6 digits' });
  }
  if (!/^[6-9]\d{9}$/.test(shippingAddress.phone.replace(/\s/g, ''))) {
    return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
  }

  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  const lines = (cart?.items || []).filter((i) => i.product && i.product.isActive);
  if (lines.length === 0) {
    return res.status(400).json({ success: false, message: 'Your bag is empty' });
  }

  // Re-check stock at checkout. It may have sold out since it was added.
  const outOfStock = lines.filter((i) => i.quantity > i.product.stock);
  if (outOfStock.length) {
    return res.status(409).json({
      success: false,
      message: `Not enough stock for: ${outOfStock.map((i) => i.product.name).join(', ')}`,
    });
  }

  // Prices read from the DB, totals recomputed here. Client numbers ignored.
  const items = lines.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    slug: i.product.slug,
    brand: i.product.brand,
    image: i.product.images?.[0]?.url || '',
    price: i.product.price,
    quantity: i.quantity,
  }));

  const lineItems = items.map((i) => ({ price: i.price, quantity: i.quantity }));

  // The coupon is re-evaluated here even though checkout previewed it: it may
  // have expired or run out in the meantime. The preview proves nothing.
  let coupon = null;
  let discount = 0;
  if (couponCode) {
    ({ coupon, discount } = await evaluateCoupon(couponCode, calculateTotals(lineItems).subtotal, req.user.id));
    if (!(await redeemCoupon(coupon._id, req.user.id))) {
      return res.status(409).json({ success: false, message: 'This coupon is no longer available' });
    }
  }

  const pricing = calculateTotals(lineItems, { discount });

  let order;
  try {
    order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress,
      pricing: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        gst: pricing.gst,
        shipping: pricing.shipping,
        total: pricing.total,
      },
      ...(coupon && { coupon: { code: coupon.code, discount: pricing.discount, couponId: coupon._id } }),
      paymentMethod,
      paymentStatus: 'pending',
      status: 'placed',
      statusHistory: [{ status: 'placed', note: `Order placed (${paymentMethod.toUpperCase()})` }],
    });
  } catch (err) {
    // The coupon was taken before the order existed - give it back.
    if (coupon) await releaseCoupon(coupon._id, req.user.id);
    throw err;
  }

  // Reserve the stock. $inc is atomic - two shoppers cannot both take the last unit.
  await Promise.all(
    items.map((i) =>
      Product.updateOne({ _id: i.product }, { $inc: { stock: -i.quantity } })
    )
  );

  // The cart has become an order; empty it.
  await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });

  /**
   * Online payment: the order exists (stock is held) but is unpaid. We hand
   * the browser a Razorpay order for the SERVER's total. If the Razorpay call
   * fails the order still stands - the shopper can retry payment from the
   * order page, or cancel it.
   */
  let razorpay = null;
  if (paymentMethod === 'razorpay') {
    try {
      razorpay = await startPayment(order);
    } catch (err) {
      console.error(`Razorpay order creation failed for ${order.orderNumber}: ${err.message}`);
    }
  }

  res.status(201).json({ success: true, order, razorpay });
};

/** Days after delivery during which a customer may ask for a return. */
export const RETURN_WINDOW_DAYS = 7;

/**
 * Puts stock back and settles the money for an order that is being cancelled
 * or returned. Online payments are refunded through Razorpay; if that fails
 * the order says so, so staff can refund by hand rather than it being lost.
 */
const releaseOrder = async (order) => {
  await Promise.all(
    order.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } }))
  );

  if (order.paymentStatus !== 'paid') return;

  if (order.paymentMethod === 'razorpay') {
    const refundId = await refundRazorpayPayment(order.paymentDetails.razorpayPaymentId, order.pricing.total);
    if (!refundId) {
      order.statusHistory.push({ status: order.status, note: 'Automatic refund failed - refund manually' });
      return;
    }
    order.statusHistory.push({ status: order.status, note: `Refund issued (${refundId})` });
  }
  order.paymentStatus = 'refunded';
};

/** @route GET /api/orders/my  @access Private */
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: orders.length, orders });
};

/** @route GET /api/orders/:id  @access Private (own order) or Admin */
export const getOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  // A customer may only read their own order. Without this check, changing the
  // id in the URL would expose someone else's address and phone number.
  const isOwner = order.user._id.toString() === req.user.id.toString();
  const isStaff = ['admin', 'superadmin'].includes(req.user.role);
  if (!isOwner && !isStaff) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }

  res.status(200).json({ success: true, order });
};

/** @route PATCH /api/orders/:id/cancel  @access Private (own order) */
export const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (order.user.toString() !== req.user.id.toString()) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }

  // Once it has shipped, cancelling is no longer the customer's call.
  if (!['placed', 'confirmed'].includes(order.status)) {
    return res.status(409).json({
      success: false,
      message: `Cannot cancel an order that is already ${order.status}`,
    });
  }

  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by customer' });
  await releaseOrder(order); // stock back, refund if it was paid online
  await order.save();

  res.status(200).json({ success: true, order });
};

/**
 * @route PATCH /api/orders/:id/return  @access Private (own order)
 * body: { reason }
 *
 * The customer only REQUESTS a return. Staff accept it (-> returned, which
 * restocks and refunds) or decline it (-> back to delivered).
 */
export const requestReturn = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (order.user.toString() !== req.user.id.toString()) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }
  if (order.status !== 'delivered') {
    return res.status(409).json({ success: false, message: 'Only delivered orders can be returned' });
  }

  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5) {
    return res.status(400).json({ success: false, message: 'Tell us briefly why you are returning it' });
  }

  const deliveredAt = order.deliveredAt
    || [...order.statusHistory].reverse().find((h) => h.status === 'delivered')?.at;
  const windowEnds = new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (!deliveredAt || Date.now() > windowEnds) {
    return res.status(409).json({
      success: false,
      message: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery`,
    });
  }

  order.status = 'return_requested';
  order.returnReason = reason.slice(0, 500);
  order.statusHistory.push({ status: 'return_requested', note: `Return requested: ${order.returnReason}` });
  await order.save();

  res.status(200).json({ success: true, order });
};

/** @route GET /api/orders  @access Admin */
export const listAllOrders = async (req, res) => {
  const { status } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const filter = status ? { status } : {};
  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), orders });
};

/** @route PATCH /api/orders/:id/status  @access Admin  body: { status, note } */
export const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  // A state machine, not a free-for-all: delivered cannot go back to placed.
  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(409).json({
      success: false,
      message: `Cannot move from '${order.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
    });
  }

  order.status = status;
  order.statusHistory.push({ status, note: note || `Set to ${status} by ${req.user.name}` });

  // Declining a return moves it back to delivered - that is not a new delivery.
  if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();

  // Cash on delivery is only actually paid once it is delivered.
  if (status === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.paymentDetails.paidAt = new Date();
  }

  if (status === 'cancelled' || status === 'returned') await releaseOrder(order);

  await order.save();
  res.status(200).json({ success: true, order });
};
