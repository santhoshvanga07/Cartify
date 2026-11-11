import mongoose from 'mongoose';
import Order, { ALLOWED_TRANSITIONS } from '../models/Order.js';
import Cart from '../models/Cart.js';
import { calculateTotals } from '../utils/pricing.js';
import { getSettings } from '../services/settings.service.js';
import { logActivity } from '../services/activity.service.js';
import {
  isRazorpayConfigured, startPayment, refundRazorpayPayment, findCapturedPayments,
} from '../services/payment.service.js';
import {
  notifyOrderPlaced, notifyStatusChange, notifyStaff, notifyPaymentReceived,
} from '../services/notification.service.js';
import { evaluateCoupon, redeemCoupon, releaseCoupon } from '../utils/coupon.js';
import { checkAddress, cleanAddress } from '../utils/address.js';
import { takeStock, putBackStock, LOW_STOCK } from '../utils/stock.js';
import { saveAddressFor } from './address.controller.js';

/** Puts units back on the shelf (into the right size/colour), e.g. for a cancelled order or a checkout that failed halfway. */
const restock = (lines) => Promise.all(lines.map((i) => putBackStock(i.product, i.variant, i.quantity)));

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
  // req.body is undefined when a request arrives without a JSON body.
  const { shippingAddress, paymentMethod = 'cod', couponCode, saveAddress } = req.body ?? {};

  if (!['cod', 'razorpay'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method' });
  }
  const { codEnabled, onlinePaymentEnabled } = getSettings();
  if (paymentMethod === 'razorpay' && !(isRazorpayConfigured() && onlinePaymentEnabled)) {
    return res.status(400).json({ success: false, message: 'Online payment is not enabled' });
  }
  if (paymentMethod === 'cod' && !codEnabled) {
    return res.status(400).json({ success: false, message: 'Cash on delivery is currently unavailable' });
  }

  const addressProblem = checkAddress(shippingAddress);
  if (addressProblem) return res.status(400).json({ success: false, message: addressProblem });

  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  const lines = (cart?.items || []).filter((i) => i.product && i.product.isActive);
  if (lines.length === 0) {
    return res.status(400).json({ success: false, message: 'Your bag is empty' });
  }

  // A size/colour that was removed (or a line saved before the product had sizes).
  const needsChoice = lines.find((i) => i.product.checkVariant(i.variant));
  if (needsChoice) {
    return res.status(409).json({
      success: false,
      message: `${needsChoice.product.name}: ${needsChoice.product.checkVariant(needsChoice.variant)} - please update your bag`,
    });
  }

  // Re-check stock at checkout. It may have sold out since it was added.
  // This gives a friendly list of every short item; the real guarantee is the
  // conditional reservation further down.
  const label = (i) => (i.variant ? `${i.product.name} (${i.variant})` : i.product.name);
  const outOfStock = lines.filter((i) => i.quantity > i.product.stockFor(i.variant));
  if (outOfStock.length) {
    return res.status(409).json({
      success: false,
      message: `Not enough stock for: ${outOfStock.map(label).join(', ')}`,
    });
  }

  // Prices read from the DB, totals recomputed here. Client numbers ignored.
  const items = lines.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    slug: i.product.slug,
    brand: i.product.brand,
    image: i.product.images?.[0]?.url || '',
    variant: i.variant || '',
    optionName: i.variant ? i.product.optionName || 'Size' : '',
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

  /**
   * Reserve the stock. Each update only matches while the product still has
   * enough units, so the check and the decrement are ONE atomic step. If two
   * shoppers race for the last unit, the database lets exactly one through.
   * (Checking stock above and then doing a plain $inc would let both pass the
   * check and drive stock below zero.)
   */
  const reserved = [];
  const runningLow = [];
  for (const item of items) {
    const after = await takeStock(item.product, item.variant, item.quantity);
    if (!after) {
      // Undo what we already took, and give the coupon back.
      await restock(reserved);
      if (coupon) await releaseCoupon(coupon._id, req.user.id);
      return res.status(409).json({
        success: false,
        message: `Sorry, ${item.variant ? `${item.name} (${item.variant})` : item.name} just sold out. Please update your bag.`,
      });
    }
    reserved.push(item);
    // Crossed the low-stock line with THIS order? Tell staff once, not on every later sale.
    const left = after.stockFor(item.variant);
    if (left <= LOW_STOCK && left + item.quantity > LOW_STOCK) runningLow.push({ ...item, left });
  }

  const pricing = calculateTotals(lineItems, { discount });

  let order;
  try {
    order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress: cleanAddress(shippingAddress),
      pricing: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        gst: pricing.gst,
        shipping: pricing.shipping,
        total: pricing.total,
        gstRate: pricing.gstRate,
      },
      ...(coupon && { coupon: { code: coupon.code, discount: pricing.discount, couponId: coupon._id } }),
      paymentMethod,
      paymentStatus: 'pending',
      status: 'placed',
      statusHistory: [{ status: 'placed', note: `Order placed (${paymentMethod.toUpperCase()})` }],
    });
  } catch (err) {
    // The coupon and stock were taken before the order existed - give them back.
    await restock(reserved);
    if (coupon) await releaseCoupon(coupon._id, req.user.id);
    throw err;
  }

  // The cart has become an order; empty it.
  await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });

  // "Save this address for next time" - best effort: a full address book must not fail the order.
  if (saveAddress === true) await saveAddressFor(req.user.id, shippingAddress).catch(() => {});

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

  notifyOrderPlaced(order, req.user);
  for (const low of runningLow) {
    const what = low.variant ? `${low.name} (${low.variant})` : low.name;
    notifyStaff(
      `Low stock: ${what}`,
      low.left === 0
        ? `${what} has just sold out. Restock it from Dashboard > Products.`
        : `Only ${low.left} of ${what} left after order ${order.orderNumber}. Restock it from Dashboard > Products.`
    );
  }
  notifyStaff(`New order ${order.orderNumber}`, `${req.user.name} placed ${order.orderNumber} for Rs ${order.pricing.total}.`);

  res.status(201).json({ success: true, order, razorpay });
};

/** Every Razorpay order created for this order (older orders only stored the latest). */
export const razorpayAttempts = (order) => {
  const ids = order.paymentDetails?.razorpayOrderIds?.length
    ? order.paymentDetails.razorpayOrderIds
    : [order.paymentDetails?.razorpayOrderId];
  return [...new Set(ids.filter(Boolean))];
};

/**
 * Puts stock back, returns the coupon and settles the money for an order that
 * is being cancelled or returned. Online payments are refunded through
 * Razorpay; if that fails the order says so, so staff can refund by hand
 * rather than it being lost.
 */
const releaseOrder = async (order) => {
  await restock(order.items);

  // The order no longer happened, so the coupon use is given back.
  if (order.coupon?.couponId) await releaseCoupon(order.coupon.couponId, order.user._id ?? order.user);

  if (order.paymentMethod !== 'razorpay') {
    if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded'; // COD: cash handed back
    return;
  }

  if (order.paymentStatus === 'paid') {
    const refundId = await refundRazorpayPayment(order.paymentDetails.razorpayPaymentId, order.pricing.total);
    if (!refundId) {
      order.statusHistory.push({ status: order.status, note: 'Automatic refund failed - refund manually' });
      return;
    }
    order.statusHistory.push({ status: order.status, note: `Refund issued (${refundId})` });
    order.paymentStatus = 'refunded';
    return;
  }

  /**
   * We think it is unpaid - but the shopper may have paid and lost the
   * connection before our verify call ran. Ask Razorpay, and refund anything
   * it actually captured, so nobody pays for a cancelled order.
   */
  const attempts = razorpayAttempts(order);
  if (!attempts.length) return;
  const captured = await findCapturedPayments(attempts);
  if (captured === null) {
    order.statusHistory.push({
      status: order.status,
      note: 'Could not confirm with Razorpay that nothing was paid - check the Razorpay dashboard',
    });
    return;
  }
  for (const paymentId of captured) {
    const refundId = await refundRazorpayPayment(paymentId, order.pricing.total);
    order.statusHistory.push({
      status: order.status,
      note: refundId
        ? `Refund issued for unrecorded payment ${paymentId} (${refundId})`
        : `Payment ${paymentId} was captured but the automatic refund failed - refund manually`,
    });
    if (refundId) order.paymentStatus = 'refunded';
  }
};

/**
 * Moves an order from one status to another ONLY if nobody else moved it
 * first. Two quick "Cancel" clicks (or two admins) both pass the in-memory
 * status check; this database-side check lets exactly one through, so stock
 * is never restored twice and a refund is never issued twice.
 */
const claimTransition = async (order, from, to) => {
  const result = await Order.updateOne({ _id: order._id, status: from }, { $set: { status: to } });
  return result.modifiedCount === 1;
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
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (order.user._id.toString() !== req.user.id.toString()) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }

  // Once it has shipped, cancelling is no longer the customer's call.
  const from = order.status;
  if (!['placed', 'confirmed'].includes(from) || !(await claimTransition(order, from, 'cancelled'))) {
    return res.status(409).json({
      success: false,
      message: `Cannot cancel an order that is already ${from === 'placed' || from === 'confirmed' ? 'being updated' : from}`,
    });
  }

  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled', note: 'Cancelled by customer' });
  await releaseOrder(order); // stock and coupon back, refund if it was paid online
  await order.save();
  notifyStatusChange(order, order.user);

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
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (order.user._id.toString() !== req.user.id.toString()) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }
  if (order.status !== 'delivered') {
    return res.status(409).json({ success: false, message: 'Only delivered orders can be returned' });
  }

  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5) {
    return res.status(400).json({ success: false, message: 'Tell us briefly why you are returning it' });
  }

  const { returnWindowDays } = getSettings();
  const deliveredAt = order.deliveredAt
    || [...order.statusHistory].reverse().find((h) => h.status === 'delivered')?.at;
  const windowEnds = new Date(deliveredAt).getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
  if (!deliveredAt || Date.now() > windowEnds) {
    return res.status(409).json({
      success: false,
      message: `Returns are accepted within ${returnWindowDays} days of delivery`,
    });
  }

  if (!(await claimTransition(order, 'delivered', 'return_requested'))) {
    return res.status(409).json({ success: false, message: 'This order was just updated - please refresh' });
  }
  order.status = 'return_requested';
  order.returnReason = reason.slice(0, 500);
  order.statusHistory.push({ status: 'return_requested', note: `Return requested: ${order.returnReason}` });
  await order.save();
  notifyStatusChange(order, order.user);
  notifyStaff(`Return requested on ${order.orderNumber}`, `${req.user.name}: ${order.returnReason}`);

  res.status(200).json({ success: true, order });
};

/** @route GET /api/orders?status=&user=&page=&limit=  @access Admin */
export const listAllOrders = async (req, res) => {
  const { status, user } = req.query;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  // Clamped on both sides: a negative limit would become a negative skip and a 500.
  const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit)) || 20));

  const filter = {};
  if (status) filter.status = String(status);
  // One customer's history, from the customers screen.
  if (user && mongoose.isValidObjectId(user)) filter.user = user;
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

/**
 * Copies courier details from the request onto the order. All optional, but a
 * tracking link must be a real http(s) address - it becomes a link in the
 * customer's email and order page, so "javascript:..." must never get through.
 * @returns {string|null} a problem to report, or null
 */
const applyShipment = (order, raw = {}) => {
  if (raw === null || typeof raw !== 'object') raw = {};
  const text = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
  let trackingUrl = text(raw.trackingUrl, 300);
  if (trackingUrl) {
    let parsed = null;
    try {
      parsed = new URL(trackingUrl);
    } catch {
      parsed = null;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      return 'The tracking link must start with http:// or https://';
    }
    trackingUrl = parsed.href; // normalised: quotes and spaces are percent-encoded
  }
  let expectedDelivery = null;
  if (raw.expectedDelivery) {
    expectedDelivery = new Date(`${String(raw.expectedDelivery).slice(0, 10)}T18:00:00+05:30`);
    if (Number.isNaN(expectedDelivery.getTime())) return 'Expected delivery must be a date';
  }
  const shippedAt = new Date();
  order.shipment = {
    courier: text(raw.courier, 60),
    trackingNumber: text(raw.trackingNumber, 60),
    trackingUrl,
    // No date given: tell the customer the usual 5 days rather than nothing.
    expectedDelivery: expectedDelivery || new Date(shippedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
    shippedAt,
  };
  return null;
};

/** @route PATCH /api/orders/:id/status  @access Admin  body: { status, note, shipment? } */
export const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body ?? {};

  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  const from = order.status;

  // A state machine, not a free-for-all: delivered cannot go back to placed.
  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    return res.status(409).json({
      success: false,
      message: `Cannot move from '${order.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
    });
  }

  // An online order is only worth fulfilling once the money has arrived.
  if (
    order.paymentMethod === 'razorpay' && order.paymentStatus !== 'paid'
    && ['confirmed', 'shipped', 'delivered'].includes(status)
  ) {
    return res.status(409).json({
      success: false,
      message: 'This order has not been paid online yet - it can only be cancelled',
    });
  }

  // Courier details are checked BEFORE the status is claimed, so a bad link changes nothing.
  if (status === 'shipped') {
    const problem = applyShipment(order, req.body?.shipment);
    if (problem) return res.status(400).json({ success: false, message: problem });
  }

  if (!(await claimTransition(order, from, status))) {
    return res.status(409).json({ success: false, message: 'This order was just updated - please refresh' });
  }

  order.status = status;
  order.statusHistory.push({
    status,
    note:
      String(note || '').slice(0, 300)
      || (status === 'shipped' && order.shipment?.courier
        ? `Shipped with ${order.shipment.courier}${order.shipment.trackingNumber ? ` (${order.shipment.trackingNumber})` : ''}`
        : `Set to ${status} by ${req.user.name}`),
  });

  // Declining a return moves it back to delivered - that is not a new delivery.
  if (status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();

  // Cash on delivery is only actually paid once it is delivered.
  if (status === 'delivered' && order.paymentMethod === 'cod' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.paymentDetails.paidAt = new Date();
  }

  if (status === 'cancelled' || status === 'returned') await releaseOrder(order);

  await order.save();
  logActivity(req, 'order.status', { type: 'order', id: order._id, label: order.orderNumber }, `${from} -> ${status}`);
  if (order.user) notifyStatusChange(order, order.user);
  res.status(200).json({ success: true, order });
};

/**
 * Cancels online orders nobody paid for, so their stock goes back on sale.
 * Runs every few minutes from server.js.
 *
 * Before cancelling, Razorpay is asked whether money DID arrive (the shopper
 * may have paid and then lost the connection). If it did, the order is
 * recorded as paid instead. If Razorpay cannot be reached, the order is left
 * alone and checked again next time - never cancelled on a guess.
 */
export const expireUnpaidOrders = async (maxAgeMinutes = 30) => {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const stale = await Order.find({
    paymentMethod: 'razorpay',
    paymentStatus: { $in: ['pending', 'failed'] },
    status: 'placed',
    createdAt: { $lt: cutoff },
  })
    .populate('user', 'name email')
    .limit(50);

  let cancelled = 0;
  for (const order of stale) {
    const attempts = razorpayAttempts(order);
    const captured = attempts.length ? await findCapturedPayments(attempts) : [];
    if (captured === null) continue;

    if (captured.length) {
      order.paymentStatus = 'paid';
      order.paymentDetails.razorpayPaymentId = captured[0];
      order.paymentDetails.paidAt = new Date();
      order.statusHistory.push({ status: order.status, note: `Paid online (${captured[0]}) - confirmed with Razorpay` });
      await order.save();
      if (order.user) notifyPaymentReceived(order, order.user);
      continue;
    }

    if (!(await claimTransition(order, 'placed', 'cancelled'))) continue;
    order.status = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      note: `Cancelled automatically - payment was not completed within ${maxAgeMinutes} minutes`,
    });
    await releaseOrder(order);
    await order.save();
    if (order.user) notifyStatusChange(order, order.user);
    cancelled++;
  }
  return cancelled;
};
