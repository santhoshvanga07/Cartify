import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('a');
await register('b');
await register('fresh');

const [x, y, z] = await Product.find({ stock: { $gt: 5 } }).limit(3);

// a buys x+y together twice, b buys x+z once -> y is the strongest pair for x
const buy = async (who, ...ps) => {
  for (const p of ps) await call(who, 'POST', '/api/cart', { productId: p._id, quantity: 1 });
  return call(who, 'POST', '/api/orders', { shippingAddress: ADDRESS });
};
await buy('a', x, y);
await buy('a', x, y);
await buy('b', x, z);

let r = await call(null, 'GET', `/api/ai/recommendations/${x.slug}/bought-together`);
expect('bought-together answers', r.status, 200);
expect('strongest pair first', r.body.products?.[0]?.slug, y.slug);
expect('never recommends the product itself', r.body.products?.some((p) => p.slug === x.slug), false);

r = await call(null, 'GET', '/api/ai/trending');
expect('trending answers', r.status, 200);
expect('best seller first', r.body.products?.[0]?.slug, x.slug);

r = await call(null, 'GET', '/api/ai/for-you');
expect('for-you needs sign-in', r.status, 401);
r = await call('fresh', 'GET', '/api/ai/for-you');
expect('no history -> empty, not an error', r.body.count, 0);
r = await call('a', 'GET', '/api/ai/for-you');
expect('for-you answers', r.status, 200);
expect('already-bought products excluded', r.body.products?.some((p) => [x.slug, y.slug].includes(p.slug)), false);

r = await call(null, 'GET', `/api/ai/by-slugs?slugs=${z.slug},${x.slug},nope,${encodeURIComponent('$where')}`);
expect('by-slugs keeps the requested order', r.body.products?.map((p) => p.slug).join(), `${z.slug},${x.slug}`);

await finish();
