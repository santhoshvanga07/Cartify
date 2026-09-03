import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './src/utils/seedCatalog.js';
import Product from './src/models/Product.js';

await connectDB();
await ensureSuperAdmin();
await seedCatalog();

const server = app.listen(5099);
const base = 'http://localhost:5099';
let cookie = '';
let pass = 0, fail = 0;

const call = async (method, path, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  const t = sc.find((c) => c.startsWith('token=') && !c.startsWith('token=;'));
  if (t) cookie = t.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const expect = (label, actual, wanted, extra = '') => {
  const ok = actual === wanted; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (expected ${wanted}, got ${actual}) ${extra}`);
};

await call('POST', '/api/auth/register', { name: 'Buyer', email: 'buyer@cartify.com', password: 'password123' });

const inStock = await Product.findOne({ stock: { $gt: 5 } });
const soldOut = await Product.findOne({ stock: 0 });
const lowStock = await Product.findOne({ stock: { $gt: 0, $lt: 6 } });

console.log('\n--- cart operations ---');
let r = await call('GET', '/api/cart');
expect('empty cart starts at zero', r.body.cart.totals.total, 0);

r = await call('POST', '/api/cart', { productId: inStock._id, quantity: 2 });
expect('add 2 items', r.status, 200, `subtotal=${r.body.cart?.totals.subtotal}`);
expect('  line total correct', r.body.cart.totals.subtotal, inStock.price * 2);

console.log('\n--- server-side money maths ---');
const t = r.body.cart.totals;
console.log(`      subtotal ${t.subtotal} | gst ${t.gst} | shipping ${t.shipping} | TOTAL ${t.total}`);
expect('GST is 18% of subtotal', t.gst, Math.round(t.subtotal * 0.18 * 100) / 100);
expect('free shipping above 5000', t.shipping, t.subtotal >= 5000 ? 0 : 99);

console.log('\n--- stock enforcement ---');
r = await call('POST', '/api/cart', { productId: soldOut._id, quantity: 1 });
expect('cannot add sold-out item', r.status, 409, `"${r.body.message}"`);

r = await call('PATCH', `/api/cart/${inStock._id}`, { quantity: 9999 });
expect('cannot exceed stock', r.status, 409, `"${r.body.message}"`);

r = await call('POST', '/api/cart', { productId: lowStock._id, quantity: lowStock.stock + 1 });
expect('cannot over-order low stock', r.status, 409);

console.log('\n--- validation & auth ---');
r = await call('PATCH', `/api/cart/${inStock._id}`, { quantity: 0 });
expect('quantity 0 rejected', r.status, 400);

r = await call('PATCH', `/api/cart/${inStock._id}`, { quantity: 1.5 });
expect('fractional quantity rejected', r.status, 400);

cookie = '';
r = await call('GET', '/api/cart');
expect('cart requires login', r.status, 401);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close();
await mongoose.connection.close();
process.exit(fail ? 1 : 0);
