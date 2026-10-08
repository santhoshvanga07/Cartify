import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import User from './src/models/User.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await call('admin', 'POST', '/api/auth/login', {
  email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD,
});
await register('shopper', 'Priya Shopper');
await register('quiet', 'Quiet Person');

const p = await Product.findOne({ stock: { $gt: 5 } });
let r;
for (let i = 0; i < 2; i++) {
  await call('shopper', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
  r = await call('shopper', 'POST', '/api/orders', { shippingAddress: ADDRESS });
}
const total2 = r.body.order.pricing.total;
await call('shopper', 'PATCH', `/api/orders/${r.body.order._id}/cancel`);

console.log('--- customer list ---');
r = await call('shopper', 'GET', '/api/users/customers');
expect('customers cannot list customers', r.status, 403);
r = await call('admin', 'GET', '/api/users/customers');
expect('admin can list customers', r.status, 200);
expect('staff are not listed as customers', r.body.customers.some((c) => c.email === process.env.SEED_ADMIN_EMAIL), false);
const priya = r.body.customers.find((c) => c.email === 'shopper@test.com');
expect('order count', priya?.orders, 2);
expect('cancelled order excluded from spend', priya?.spent, Math.round(total2 * 100) / 100);
expect('customer without orders shows 0', r.body.customers.find((c) => c.email === 'quiet@test.com')?.orders, 0);

r = await call('admin', 'GET', '/api/users/customers?q=PRIYA');
expect('search by name (case-insensitive)', r.body.total, 1);
r = await call('admin', 'GET', '/api/users/customers?q=' + encodeURIComponent('.*'));
expect('regex characters are literal', r.body.total, 0);

console.log('\n--- orders for one customer ---');
r = await call('admin', 'GET', `/api/orders?user=${priya._id}`);
expect('filter orders by customer', r.body.total, 2);

console.log('\n--- blocking ---');
r = await call('admin', 'PATCH', `/api/users/${priya._id}/status`, { isActive: false });
expect('admin can block a customer', r.status, 200);
r = await call('shopper', 'GET', '/api/auth/me');
expect('blocked customer is locked out', r.status, 403);
r = await call('admin', 'PATCH', `/api/users/${priya._id}/status`, { isActive: true });
expect('admin can unblock', r.body.user?.isActive, true);

const sa = await User.findOne({ email: process.env.SEED_SUPERADMIN_EMAIL });
r = await call('admin', 'PATCH', `/api/users/${sa._id}/status`, { isActive: false });
expect('admin cannot suspend the Super Admin', r.status, 403);
const admin = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL });
r = await call('sa', 'PATCH', `/api/users/${admin._id}/status`, { isActive: false });
expect('Super Admin can still suspend an admin', r.status, 200);

await finish();
