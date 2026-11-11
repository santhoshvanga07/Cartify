import crypto from 'node:crypto';

/**
 * Razorpay, spoken to directly over its REST API.
 *
 * The SDK would add a dependency for two calls. Creating an order is one
 * authenticated POST; verifying a payment is one HMAC. Doing both by hand
 * also makes it obvious what the security actually rests on: the signature.
 */

// RAZORPAY_API_URL exists only so automated tests can point at a fake Razorpay; leave it unset.
const API = process.env.RAZORPAY_API_URL || 'https://api.razorpay.com/v1';

const authHeader = () =>
  `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;

export const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/** Rupees -> paise. Razorpay only accepts whole paise. */
export const toPaise = (rupees) => Math.round(rupees * 100);

/**
 * Creates a Razorpay order for an amount we computed. The browser then pays
 * THIS order - so the amount can never be chosen by the client.
 */
export const createRazorpayOrder = async ({ amount, receipt, notes }) => {

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: toPaise(amount), currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.description || 'Could not start the payment');
    err.statusCode = 502;
    throw err;
  }
  return data; // { id, amount, currency, ... }
};

/** Creates a Razorpay order for an existing Cartify order and stores its id. */
export const startPayment = async (order) => {
  const rzp = await createRazorpayOrder({
    amount: order.pricing.total,
    receipt: order.orderNumber,
    notes: { cartifyOrderId: String(order._id) },
  });
  order.paymentDetails.razorpayOrderId = rzp.id;
  order.paymentDetails.razorpayOrderIds.push(rzp.id);
  await order.save();
  return { orderId: rzp.id, amount: rzp.amount, currency: rzp.currency, keyId: process.env.RAZORPAY_KEY_ID };
};

/**
 * Checks the signature Razorpay hands the browser after a successful payment.
 *
 * The browser could claim anything - "I paid" is just a POST body. But only
 * Razorpay and this server know the key secret, so only Razorpay can produce
 * HMAC(order_id|payment_id). A matching signature is proof of payment.
 */
export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // timingSafeEqual needs equal lengths; a length mismatch is simply invalid.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Refunds a captured payment in full. Called when a paid order is cancelled
 * or returned.
 * @returns {string|null} the refund id, or null when the refund failed
 */
export const refundRazorpayPayment = async (paymentId, amount) => {
  if (!isRazorpayConfigured() || !paymentId) return null;
  try {
    const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: toPaise(amount) }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.description || `HTTP ${res.status}`);
    return data.id;
  } catch (err) {
    console.error(`Razorpay refund failed for ${paymentId}: ${err.message}`);
    return null;
  }
};

/**
 * Money Razorpay actually CAPTURED for an order, across every payment attempt.
 *
 * Used before cancelling an order we believe is unpaid: the shopper may have
 * paid and then lost the connection before our verify call ran. Without this
 * check that money would be kept for a cancelled order.
 *
 * @returns {Promise<string[]|null>} captured payment ids, or null when Razorpay
 *          could not be asked (the caller must then NOT assume "unpaid").
 */
export const findCapturedPayments = async (razorpayOrderIds = []) => {
  if (!isRazorpayConfigured()) return null;
  const captured = [];
  try {
    for (const id of new Set(razorpayOrderIds)) {
      const res = await fetch(`${API}/orders/${encodeURIComponent(id)}/payments`, {
        headers: { Authorization: authHeader() },
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.description || `HTTP ${res.status}`);
      for (const p of data.items || []) if (p.status === 'captured') captured.push(p.id);
    }
    return captured;
  } catch (err) {
    console.error(`Could not list Razorpay payments: ${err.message}`);
    return null;
  }
};
