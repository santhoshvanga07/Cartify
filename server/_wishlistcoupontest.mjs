import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import Coupon from './src/models/Coupon.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('ann');
await register('ben');

const cheap = await Product.findOne({ stock: { $gt: 5 }, price: { $lt: 3000 } });
const pricey = await Product.findOne({ stock: { $gt: 5 }, price: { $gt: 20000 } });

console.log('--- wishlist ---');
let r = await call(null, 'GET', '/api/wishlist');
expect('guest cannot read a wishlist', r.status, 401);

r = await call('ann', 'POST', `/api/wishlist/${cheap._id}`);
expect('add to wishlist', r.status, 200);
r = await call('ann', 'POST', `/api/wishlist/${cheap._id}`);
expect('adding twice does not duplicate', r.body.wishlist?.count, 1);
r = await call('ann', 'POST', `/api/wishlist/${pricey._id}`);
expect('second product added', r.body.wishlist?.count, 2);

r = await call('ben', 'GET', '/api/wishlist');
expect('wishlists are per user', r.body.wishlist?.count, 0);

r = await call('ann', 'POST', `/api/wishlist/${cheap._id}/move-to-cart`);
expect('move to cart', r.status, 200);
expect('moved item leaves the wishlist', r.body.wishlist?.count, 1);
r = await call('ann', 'GET', '/api/cart');
expect('moved item is in the bag', r.body.cart?.items?.[0]?.product?._id, String(cheap._id));

r = await call('ann', 'DELETE', `/api/wishlist/${pricey._id}`);
expect('remove from wishlist', r.body.wishlist?.count, 0);

console.log('\n--- coupon admin ---');
r = await call('ann', 'POST', '/api/coupons', { code: 'HACK', type: 'flat', value: 100000 });
expect('customer cannot create coupons', r.status, 403);

r = await call('sa', 'POST', '/api/coupons', {
  code: 'test20', type: 'percent', value: 20, maxDiscount: 300, usedCount: -50,
});
expect('admin creates a coupon', r.status, 201);
expect('code stored upper-case', r.body.coupon?.code, 'TEST20');
expect('usedCount cannot be mass-assigned', r.body.coupon?.usedCount, 0);
const test20 = r.body.coupon;

r = await call('sa', 'POST', '/api/coupons', { code: 'BIG', type: 'percent', value: 95 });
expect('percent over 90 rejected', r.status, 400);
r = await call('sa', 'POST', '/api/coupons', { code: 'TEST20', type: 'flat', value: 5 });
expect('duplicate code rejected', r.status, 409);

await call('sa', 'POST', '/api/coupons', {
  code: 'OLD', type: 'flat', value: 50, expiresAt: new Date(Date.now() - 86400000),
});
await call('sa', 'POST', '/api/coupons', { code: 'BIGSPEND', type: 'flat', value: 50, minOrder: 1000000 });
await call('sa', 'POST', '/api/coupons', { code: 'ONCE', type: 'flat', value: 10, usageLimit: 1 });

console.log('\n--- coupon preview ---');
r = await call('ann', 'POST', '/api/coupons/apply', { code: 'NOPE' });
expect('unknown code rejected', r.status, 400, `"${r.body.message}"`);
r = await call('ann', 'POST', '/api/coupons/apply', { code: 'OLD' });
expect('expired code rejected', r.status, 400, `"${r.body.message}"`);
r = await call('ann', 'POST', '/api/coupons/apply', { code: 'BIGSPEND' });
expect('min order enforced', r.status, 400, `"${r.body.message}"`);

r = await call('ann', 'POST', '/api/coupons/apply', { code: 'test20' });
expect('valid coupon previews', r.status, 200);
const expected = Math.min(300, Math.round(cheap.price * 0.2 * 100) / 100);
expect('discount is 20% capped at 300', r.body.coupon?.discount, expected);
expect('totals include discount', r.body.totals?.discount, expected);

console.log('\n--- coupon at checkout ---');
r = await call('ann', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'TEST20' });
expect('order with coupon placed', r.status, 201);
expect('order records the coupon', r.body.order?.coupon?.code, 'TEST20');
expect('order discount matches preview', r.body.order?.pricing?.discount, expected);

await call('ann', 'POST', '/api/cart', { productId: cheap._id, quantity: 1 });
r = await call('ann', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'TEST20' });
expect('same customer cannot reuse a coupon', r.status, 400, `"${r.body.message}"`);
r = await call('ann', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'bitcoin' });
expect('unknown payment method rejected', r.status, 400);

r = await call('ann', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'ONCE' });
expect('ONCE used by ann', r.status, 201);
await call('ben', 'POST', '/api/cart', { productId: cheap._id, quantity: 1 });
r = await call('ben', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'ONCE' });
expect('usage limit enforced for others', r.status, 400, `"${r.body.message}"`);

const stored = await Coupon.findOne({ code: 'TEST20' });
expect('usedCount incremented', stored.usedCount, 1);

r = await call('sa', 'PUT', `/api/coupons/${test20._id}`, { isActive: false });
expect('admin can deactivate', r.body.coupon?.isActive, false);
r = await call('ben', 'POST', '/api/coupons/apply', { code: 'TEST20' });
expect('inactive coupon rejected', r.status, 400);
r = await call('sa', 'DELETE', `/api/coupons/${test20._id}`);
expect('admin can delete', r.status, 200);

await finish();
