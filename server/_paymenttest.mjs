/**
 * Razorpay flow without touching Razorpay: test keys are set and the two
 * Razorpay endpoints are answered by a stub. Everything else (our own API,
 * the HMAC check) runs for real.
 */
// These scripts register throwaway customers and order straight away; the
// email-confirmation step itself is tested in _accounttest.
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';
import crypto from 'node:crypto';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'test_secret_123';

const realFetch = globalThis.fetch;
let rzpCount = 0;
const refunds = [];
// Payments Razorpay has CAPTURED, per Razorpay order - what GET /orders/:id/payments returns.
const captured = {};
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  const listing = u.match(/^https:\/\/api\.razorpay\.com\/v1\/orders\/([^/]+)\/payments$/);
  if (listing) {
    const items = (captured[listing[1]] || []).map((id) => ({ id, status: 'captured' }));
    return new Response(JSON.stringify({ items }));
  }
  if (u === 'https://api.razorpay.com/v1/orders') {
    const body = JSON.parse(opts.body);
    return new Response(JSON.stringify({ id: `order_TEST${++rzpCount}`, amount: body.amount, currency: 'INR' }));
  }
  if (u.startsWith('https://api.razorpay.com/v1/payments/')) {
    refunds.push(u);
    return new Response(JSON.stringify({ id: `rfnd_TEST${refunds.length}` }));
  }
  return realFetch(url, opts);
};

const { startHarness, ADDRESS } = await import('./_harness.mjs');
const { default: Product } = await import('./src/models/Product.js');
const { default: Order } = await import('./src/models/Order.js');
const { outbox } = await import('./src/services/email.service.js');
const tick = () => new Promise((res) => setTimeout(res, 50));
const mailsTo = (email) => outbox.filter((m) => m.to === email);

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('payer');
await register('thief');

const sign = (orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

const p = await Product.findOne({ stock: { $gt: 5 } });

console.log('--- config ---');
let r = await call(null, 'GET', '/api/payments/config');
expect('razorpay reported as enabled', r.body.razorpay, true);
expect('key id is exposed', r.body.keyId, 'rzp_test_dummy');
expect('secret is NOT exposed', JSON.stringify(r.body).includes('test_secret'), false);

console.log('\n--- online checkout: NOT an order until it is paid ---');
await call('payer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
const stockAtStart = (await Product.findById(p._id)).stock;
r = await call('payer', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'razorpay' });
expect('checkout started', r.status, 201);
expect('  it is waiting for payment, not placed', r.body.order?.status, 'awaiting_payment');
expect('payment pending', r.body.order?.paymentStatus, 'pending');
expect('razorpay order returned', r.body.razorpay?.orderId, 'order_TEST1');
expect('amount is server total in paise', r.body.razorpay?.amount, Math.round(r.body.order.pricing.total * 100));
const order = r.body.order;
expect('  the item is held for the shopper', (await Product.findById(p._id)).stock, stockAtStart - 1);
expect('  the bag is untouched', (await call('payer', 'GET', '/api/cart')).body.cart?.items?.length, 1);
expect('  it is not in "your orders"', (await call('payer', 'GET', '/api/orders/my')).body.count, 0);
expect('  nor in the admin order list', (await call('sa', 'GET', '/api/orders')).body.orders?.some((o) => o._id === order._id), false);
await tick();
expect('  and no "order placed" email went out', mailsTo('payer@test.com').some((m) => m.subject.includes(order.orderNumber)), false);

console.log('\n--- verification ---');
r = await call('thief', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_TEST1', 'pay_1'),
});
expect('someone else cannot verify my order', r.status, 403);

r = await call('payer', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_OTHER', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_OTHER', 'pay_1'),
});
expect('signature for a different razorpay order rejected', r.status, 400);

r = await call('payer', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_TEST1', 'pay_1', 'wrong'),
});
expect('forged signature rejected', r.status, 400);
expect('order marked failed', (await Order.findById(order._id)).paymentStatus, 'failed');

r = await call('payer', 'POST', `/api/payments/${order._id}/retry`);
expect('retry gives a fresh razorpay order', r.body.razorpay?.orderId, 'order_TEST2');

// The shopper still had the FIRST checkout window open and paid there. That
// money is real, so it must be recorded, not rejected.
r = await call('payer', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_2', razorpay_signature: sign('order_TEST1', 'pay_2'),
});
expect('payment in an earlier checkout window accepted', r.status, 200);
expect('order now paid', r.body.order?.paymentStatus, 'paid');
expect('  and only now placed', r.body.order?.status, 'placed');
expect('  the bought line left the bag', (await call('payer', 'GET', '/api/cart')).body.cart?.items?.length, 0);
expect('  it is in "your orders"', (await call('payer', 'GET', '/api/orders/my')).body.count, 1);
await tick();
expect('  the "order placed" email went out', mailsTo('payer@test.com').some((m) => m.subject === `Order ${order.orderNumber} placed`), true);
expect('  saying it is paid', mailsTo('payer@test.com').find((m) => m.subject === `Order ${order.orderNumber} placed`)?.text.includes('Online - paid'), true);

r = await call('payer', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_2', razorpay_signature: sign('order_TEST1', 'pay_2'),
});
expect('same payment reported twice is fine', r.status, 200);

// ...and then ALSO paid in the second window: the extra payment goes back.
r = await call('payer', 'POST', `/api/payments/${order._id}/verify`, {
  razorpay_order_id: 'order_TEST2', razorpay_payment_id: 'pay_3', razorpay_signature: sign('order_TEST2', 'pay_3'),
});
expect('second payment for a paid order refused', r.status, 409, `"${r.body.message}"`);
expect('second payment refunded', refunds.some((u) => u.includes('/payments/pay_3/refund')), true);

r = await call('payer', 'POST', `/api/payments/${order._id}/retry`);
expect('cannot pay twice', r.status, 409);

console.log('\n--- refund on cancel ---');
r = await call('payer', 'PATCH', `/api/orders/${order._id}/cancel`);
expect('paid order cancelled', r.status, 200);
expect('payment refunded', r.body.order?.paymentStatus, 'refunded');
expect('refund sent to razorpay for pay_2', refunds.some((u) => u.includes('/payments/pay_2/refund')), true);
expect('cancel response has the owner populated', r.body.order?.user?.email, 'payer@test.com');

r = await call('payer', 'PATCH', `/api/orders/${order._id}/cancel`);
expect('cancelling twice is refused', r.status, 409);

console.log('\n--- closing the payment window ---');
const placeOnline = async (as = 'payer') => {
  await call(as, 'DELETE', '/api/cart');
  await call(as, 'POST', '/api/cart', { productId: p._id, quantity: 1 });
  const res = await call(as, 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'razorpay' });
  return res.body;
};
let placed = await placeOnline();
r = await call('sa', 'PATCH', `/api/orders/${placed.order._id}/status`, { status: 'confirmed' });
expect('staff cannot confirm a checkout that is not paid', r.status, 409, `"${r.body.message}"`);
r = await call('payer', 'PATCH', `/api/orders/${placed.order._id}/cancel`);
expect('there is no order to cancel', r.status, 409);
// Razorpay DID capture pay_lost, but the browser never told us (closed tab, lost signal).
captured[placed.razorpay.orderId] = ['pay_lost'];
const stockHeld = (await Product.findById(p._id)).stock;
const retryCheckout = await placeOnline(); // the shopper simply checks out again
let old = await Order.findById(placed.order._id);
expect('checking out again lets go of the unpaid attempt', old.status, 'abandoned');
expect('  its money is found and refunded', refunds.some((u) => u.includes('/payments/pay_lost/refund')), true);
expect('  shown as refunded', old.paymentStatus, 'refunded');
expect('  only one unit is held, not two', (await Product.findById(p._id)).stock, stockHeld);
await tick();
expect('  no "cancelled" email for an order they never saw', mailsTo('payer@test.com').some((m) => m.subject.includes(placed.order.orderNumber)), false);
expect('  and it is not in "your orders"', (await call('payer', 'GET', '/api/orders/my')).body.orders?.some((o) => o._id === placed.order._id), false);
r = await call('sa', 'GET', '/api/orders?status=abandoned');
expect('admins can still see abandoned checkouts when they ask', r.body.orders?.some((o) => o._id === placed.order._id), true);

// The first window is still open and the shopper pays there AFTER it was let go.
r = await call('payer', 'POST', `/api/payments/${placed.order._id}/verify`, {
  razorpay_order_id: placed.razorpay.orderId, razorpay_payment_id: 'pay_late',
  razorpay_signature: sign(placed.razorpay.orderId, 'pay_late'),
});
expect('a payment for a let-go checkout is refused', r.status, 409, `"${r.body.message}"`);
expect('  and refunded', refunds.some((u) => u.includes('/payments/pay_late/refund')), true);

console.log('\n--- unpaid checkouts expire after 30 minutes ---');
const { expireUnpaidOrders } = await import('./src/controllers/order.controller.js');
const stale = retryCheckout; // payer's checkout, never paid
const paidLate = await placeOnline('thief'); // another shopper whose payment did arrive
captured[paidLate.razorpay.orderId] = ['pay_found'];
const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
await Order.collection.updateMany(
  { _id: { $in: [stale.order._id, paidLate.order._id].map((id) => new (Order.base.Types.ObjectId)(id)) } },
  { $set: { createdAt: hourAgo } }
);
const stockBeforeSweep = (await Product.findById(p._id)).stock;
const n = await expireUnpaidOrders(30);
expect('one unpaid checkout let go', n, 1);
expect('  it is abandoned, not an order', (await Order.findById(stale.order._id)).status, 'abandoned');
expect('  its stock is back on sale', (await Product.findById(p._id)).stock, stockBeforeSweep + 1);
const found = await Order.findById(paidLate.order._id);
expect('a checkout whose payment did arrive becomes a placed, paid order', `${found.status}/${found.paymentStatus}`, 'placed/paid');
await tick();
expect('  and that customer gets the "order placed" email', mailsTo('thief@test.com').some((m) => m.subject === `Order ${found.orderNumber} placed`), true);
expect('fresh unpaid checkouts are left alone', await expireUnpaidOrders(30), 0);

console.log('\n--- returns ---');
// The unpaid checkout above left the bag as it was, so start from an empty one.
await call('payer', 'DELETE', '/api/cart');
await call('payer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('payer', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'cod' });
const cod = r.body.order;
r = await call('payer', 'PATCH', `/api/orders/${cod._id}/return`, { reason: 'Changed my mind' });
expect('cannot return an undelivered order', r.status, 409);

for (const s of ['confirmed', 'shipped', 'delivered']) {
  await call('sa', 'PATCH', `/api/orders/${cod._id}/status`, { status: s });
}
r = await call('payer', 'PATCH', `/api/orders/${cod._id}/return`, { reason: '' });
expect('reason is required', r.status, 400);
r = await call('thief', 'PATCH', `/api/orders/${cod._id}/return`, { reason: 'Not mine at all' });
expect('cannot return someone else\'s order', r.status, 403);
r = await call('payer', 'PATCH', `/api/orders/${cod._id}/return`, { reason: 'Wrong size' });
expect('return requested', r.body.order?.status, 'return_requested');

const stockBefore = (await Product.findById(p._id)).stock;
r = await call('sa', 'PATCH', `/api/orders/${cod._id}/status`, { status: 'returned' });
expect('admin accepts return', r.body.order?.status, 'returned');
expect('COD refund marked', r.body.order?.paymentStatus, 'refunded');
expect('stock restored', (await Product.findById(p._id)).stock, stockBefore + 1);

// Outside the window
await call('payer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('payer', 'POST', '/api/orders', { shippingAddress: ADDRESS });
const late = r.body.order;
for (const s of ['confirmed', 'shipped', 'delivered']) {
  await call('sa', 'PATCH', `/api/orders/${late._id}/status`, { status: s });
}
await Order.updateOne({ _id: late._id }, { deliveredAt: new Date(Date.now() - 8 * 86400000) });
r = await call('payer', 'PATCH', `/api/orders/${late._id}/return`, { reason: 'Too late now' });
expect('return window enforced', r.status, 409, `"${r.body.message}"`);

console.log('\n--- disabled when unconfigured ---');
delete process.env.RAZORPAY_KEY_ID;
await call('payer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('payer', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'razorpay' });
expect('online payment refused without keys', r.status, 400);

await finish();
