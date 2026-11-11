import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './tests/fixtures/seedCatalog.js';
import Product from './src/models/Product.js';

await connectDB(); await ensureSuperAdmin(); await seedCatalog();
const server = app.listen(5099);
const base = 'http://localhost:5099';
const jars = {}; let pass = 0, fail = 0;

const call = async (as, method, path, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (jars[as]) headers.Cookie = jars[as];
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = (r.headers.getSetCookie?.() ?? []).find(c => c.startsWith('token=') && !c.startsWith('token=;'));
  if (t) jars[as] = t.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const expect = (l, a, w, x = '') => { const ok = a === w; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  (want ${w}, got ${a}) ${x}`); };

const ADDRESS = { fullName: 'Dheeraj M', phone: '9876543210', line1: '12 MG Road',
                  city: 'Hyderabad', state: 'Telangana', pincode: '500081' };

await call('sa', 'POST', '/api/auth/login', { email: process.env.SEED_SUPERADMIN_EMAIL, password: process.env.SEED_SUPERADMIN_PASSWORD });
await call('cust', 'POST', '/api/auth/register', { name: 'Buyer', email: 'b2@cartify.com', password: 'password123' });

const p1 = await Product.findOne({ stock: { $gt: 5 } });
const stockBefore = p1.stock;

console.log('\n--- address validation ---');
let r = await call('cust', 'POST', '/api/orders', { shippingAddress: { ...ADDRESS, pincode: '12' } });
expect('bad pincode rejected', r.status, 400, `"${r.body.message}"`);
r = await call('cust', 'POST', '/api/orders', { shippingAddress: { ...ADDRESS, phone: '12345' } });
expect('bad phone rejected', r.status, 400, `"${r.body.message}"`);
r = await call('cust', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('empty bag cannot checkout', r.status, 400, `"${r.body.message}"`);

console.log('\n--- place a COD order ---');
await call('cust', 'POST', '/api/cart', { productId: p1._id, quantity: 2 });
r = await call('cust', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'cod' });
expect('order created', r.status, 201, r.body.order?.orderNumber);
const order = r.body.order;
expect('  price snapshotted', order.items[0].price, p1.price);
expect('  total = subtotal + gst + shipping', order.pricing.total,
  Math.round((order.pricing.subtotal + order.pricing.gst + order.pricing.shipping) * 100) / 100);
expect('  COD starts unpaid', order.paymentStatus, 'pending');

const after = await Product.findById(p1._id);
expect('stock decremented', after.stock, stockBefore - 2);
r = await call('cust', 'GET', '/api/cart');
expect('cart emptied after checkout', r.body.cart.items.length, 0);

console.log('\n--- client cannot dictate price ---');
await call('cust', 'POST', '/api/cart', { productId: p1._id, quantity: 1 });
r = await call('cust', 'POST', '/api/orders', {
  shippingAddress: ADDRESS, paymentMethod: 'cod',
  pricing: { subtotal: 1, gst: 0, shipping: 0, total: 1 }, items: [{ price: 1 }],
});
expect('injected total IGNORED', r.body.order.pricing.total > 1000, true,
  `client sent 1, server charged ${r.body.order.pricing.total}`);
const order2 = r.body.order;

console.log('\n--- ownership ---');
r = await call('cust', 'GET', `/api/orders/${order._id}`);
expect('owner can read own order', r.status, 200);
await call('other', 'POST', '/api/auth/register', { name: 'Nosy', email: 'nosy@cartify.com', password: 'password123' });
r = await call('other', 'GET', `/api/orders/${order._id}`);
expect('stranger BLOCKED from order', r.status, 403, `"${r.body.message}"`);
r = await call('sa', 'GET', `/api/orders/${order._id}`);
expect('admin can read any order', r.status, 200);

console.log('\n--- status state machine ---');
r = await call('sa', 'PATCH', `/api/orders/${order._id}/status`, { status: 'delivered' });
expect('cannot skip placed -> delivered', r.status, 409, `"${r.body.message}"`);
r = await call('cust', 'PATCH', `/api/orders/${order._id}/status`, { status: 'confirmed' });
expect('customer cannot set status', r.status, 403);
for (const s of ['confirmed', 'shipped', 'delivered']) {
  r = await call('sa', 'PATCH', `/api/orders/${order._id}/status`, { status: s });
  expect(`admin: -> ${s}`, r.status, 200);
}
expect('COD marked paid on delivery', r.body.order.paymentStatus, 'paid');

console.log('\n--- cancellation ---');
r = await call('cust', 'PATCH', `/api/orders/${order._id}/cancel`);
expect('cannot cancel delivered order', r.status, 409, `"${r.body.message}"`);
const beforeCancel = (await Product.findById(p1._id)).stock;
r = await call('cust', 'PATCH', `/api/orders/${order2._id}/cancel`);
expect('can cancel a new order', r.status, 200);
expect('stock restored on cancel', (await Product.findById(p1._id)).stock, beforeCancel + 1);

console.log('\n--- two shoppers race for the last unit ---');
const lastOne = await Product.findOne({ _id: { $ne: p1._id }, isActive: true });
await Product.updateOne({ _id: lastOne._id }, { stock: 1 });
for (const who of ['racer1', 'racer2']) {
  await call(who, 'POST', '/api/auth/register', { name: who, email: `${who}@cartify.com`, password: 'password123' });
  await call(who, 'POST', '/api/cart', { productId: lastOne._id, quantity: 1 });
}
// Both carts passed the stock check; now both check out at the same moment.
const race = await Promise.all(['racer1', 'racer2'].map((who) =>
  call(who, 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'cod' })));
expect('exactly one shopper gets the last unit', race.filter((x) => x.status === 201).length, 1);
expect('the other is told it sold out', race.filter((x) => x.status === 409).length, 1);
expect('stock never goes below zero', (await Product.findById(lastOne._id)).stock, 0);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); await mongoose.connection.close(); process.exit(fail ? 1 : 0);
