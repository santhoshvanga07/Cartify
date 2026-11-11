// Test accounts are made up: skip the sign-up email code (tested in _accounttest).
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './tests/fixtures/seedCatalog.js';
import Product from './src/models/Product.js';
import Order from './src/models/Order.js';
import User from './src/models/User.js';

await connectDB();
await ensureSuperAdmin();
await seedCatalog();

const server = app.listen(5099);
const base = 'http://localhost:5099';
const jars = {};
let pass = 0, fail = 0;

const call = async (as, method, path, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (jars[as]) headers.Cookie = jars[as];
  const r = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = (r.headers.getSetCookie?.() ?? []).find(
    (c) => c.startsWith('token=') && !c.startsWith('token=;')
  );
  if (t && as) jars[as] = t.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const expect = (label, actual, wanted, extra = '') => {
  const ok = actual === wanted;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (want ${wanted}, got ${actual}) ${extra}`);
};

await call('sa', 'POST', '/api/auth/login', {
  email: process.env.SEED_SUPERADMIN_EMAIL,
  password: process.env.SEED_SUPERADMIN_PASSWORD,
});
for (const [key, name] of [['alice', 'Alice'], ['bob', 'Bob'], ['carol', 'Carol'], ['dave', 'Dave']]) {
  await call(key, 'POST', '/api/auth/register', {
    name,
    email: `${key}@c.com`,
    password: 'password123',
  });
}

const product = await Product.findOne({ slug: 'nothing-phone-2a' });
console.log(`product starts at ratingAvg ${product.ratingAvg}, numReviews ${product.numReviews}`);

// Give Alice a DELIVERED order containing this product -> verified purchase
const alice = await User.findOne({ email: 'alice@c.com' });
await Order.create({
  user: alice._id,
  items: [{
    product: product._id, name: product.name, slug: product.slug,
    brand: product.brand, price: product.price, quantity: 1,
  }],
  shippingAddress: {
    fullName: 'Alice', phone: '9876543210', line1: '1 Road',
    city: 'Pune', state: 'MH', pincode: '411001',
  },
  pricing: { subtotal: product.price, gst: 0, shipping: 0, total: product.price },
  paymentMethod: 'cod',
  status: 'delivered',
});

console.log('\n--- creating reviews ---');
let r = await call('alice', 'POST', `/api/products/${product.slug}/reviews`, {
  rating: 5, title: 'Excellent', comment: 'Battery lasts two days.',
});
expect('buyer can review', r.status, 201);
expect('  marked VERIFIED purchase', r.body.review?.isVerifiedPurchase, true);
const aliceReview = r.body.review?._id;

r = await call('bob', 'POST', `/api/products/${product.slug}/reviews`, {
  rating: 3, comment: 'It is fine, nothing special.',
});
expect('non-buyer can still review', r.status, 201);
expect('  NOT marked verified', r.body.review?.isVerifiedPurchase, false);
const bobReview = r.body.review?._id;

console.log('\n--- validation and duplicates ---');
r = await call('alice', 'POST', `/api/products/${product.slug}/reviews`, { rating: 4, comment: 'Second go' });
expect('one review per user per product', r.status, 409, `"${r.body.message}"`);

r = await call('carol', 'POST', `/api/products/${product.slug}/reviews`, { rating: 9, comment: 'Out of range' });
expect('rating above 5 rejected', r.status, 400, `"${r.body.message}"`);

r = await call('carol', 'POST', `/api/products/${product.slug}/reviews`, { rating: 4.5, comment: 'Half a star' });
expect('half-star rating rejected', r.status, 400, `"${r.body.message}"`);

r = await call('carol', 'POST', `/api/products/${product.slug}/reviews`, { rating: 4 });
expect('missing comment rejected', r.status, 400);

r = await call('anon', 'POST', `/api/products/${product.slug}/reviews`, { rating: 4, comment: 'Hi' });
expect('guest cannot review', r.status, 401);

console.log('\n--- denormalised rating on Product ---');
let fresh = await Product.findById(product._id);
expect('numReviews updated', fresh.numReviews, 2);
expect('ratingAvg = (5+3)/2', fresh.ratingAvg, 4);

console.log('\n--- helpful votes ---');
r = await call('bob', 'POST', `/api/reviews/${aliceReview}/helpful`);
expect('can mark helpful', r.body.helpfulCount, 1);
r = await call('bob', 'POST', `/api/reviews/${aliceReview}/helpful`);
expect('clicking again removes the vote', r.body.helpfulCount, 0);
r = await call('alice', 'POST', `/api/reviews/${aliceReview}/helpful`);
expect('cannot vote on own review', r.status, 400, `"${r.body.message}"`);

console.log('\n--- ownership ---');
r = await call('bob', 'PUT', `/api/reviews/${aliceReview}`, { rating: 1 });
expect('cannot edit another user review', r.status, 403);
r = await call('alice', 'PUT', `/api/reviews/${aliceReview}`, { rating: 4 });
expect('can edit own review', r.status, 200);
fresh = await Product.findById(product._id);
expect('  rating recalculated after edit', fresh.ratingAvg, 3.5);

console.log('\n--- reporting and auto-hide ---');
for (const who of ['carol', 'dave']) {
  await call(who, 'POST', `/api/reviews/${bobReview}/report`, { reason: 'spam' });
}
r = await call('carol', 'POST', `/api/reviews/${bobReview}/report`, { reason: 'again' });
expect('cannot report twice', r.status, 409);
r = await call('alice', 'POST', `/api/reviews/${bobReview}/report`, { reason: 'spam' });
expect('third report accepted', r.status, 200);
fresh = await Product.findById(product._id);
expect('auto-hidden after 3 reports', fresh.numReviews, 1, '(excluded from rating)');

console.log('\n--- moderation ---');
r = await call('bob', 'GET', '/api/reviews/reported');
expect('customer blocked from queue', r.status, 403);
r = await call('sa', 'GET', '/api/reviews/reported');
expect('admin sees moderation queue', r.status, 200, `${r.body.count} reported`);
r = await call('sa', 'PATCH', `/api/reviews/${bobReview}/approve`, { isApproved: true });
expect('admin can restore', r.status, 200, `"${r.body.message}"`);
fresh = await Product.findById(product._id);
expect('  counted again after restore', fresh.numReviews, 2);

console.log('\n--- public list ---');
r = await call('anon', 'GET', `/api/products/${product.slug}/reviews`);
expect('guest can read reviews', r.status, 200, `${r.body.count} shown`);
expect('  isMine false for guest', r.body.reviews[0].isMine, false);
r = await call('alice', 'GET', `/api/products/${product.slug}/reviews`);
expect('signed-in sees own review flagged', r.body.reviews.some((x) => x.isMine), true);
console.log('      breakdown:', JSON.stringify(r.body.breakdown));

console.log('\n--- deletion ---');
r = await call('alice', 'DELETE', `/api/reviews/${aliceReview}`);
expect('can delete own review', r.status, 200);
fresh = await Product.findById(product._id);
expect('  rating recalculated after delete', fresh.numReviews, 1);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close();
await mongoose.connection.close();
process.exit(fail ? 1 : 0);
