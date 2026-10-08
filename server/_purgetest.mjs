import { startHarness, ADDRESS } from './_harness.mjs';
import seedOrders from './tests/fixtures/seedOrders.js';
import purgeDemoData from './scripts/purgeDemoData.js';
import Product from './src/models/Product.js';
import Category from './src/models/Category.js';
import Coupon from './src/models/Coupon.js';
import User from './src/models/User.js';
import Order from './src/models/Order.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await seedOrders();
await Coupon.create({ code: 'WELCOME10', type: 'percent', value: 10 });
await loginSuperAdmin();

// Real data that must survive: a real category, a real product in a DEMO
// category, a real customer, a real coupon.
const realCat = await new Category({ name: 'Handmade Pottery' }).save();
const laptops = await Category.findOne({ name: 'Laptops' });
let r = await call('sa', 'POST', '/api/products', {
  name: 'Clay Mug', brand: 'Studio K', description: 'A mug', price: 499, mrp: 599, category: realCat._id, stock: 10,
});
const mug = r.body.product;
r = await call('sa', 'POST', '/api/products', {
  name: 'ThinkPad X1 (real stock)', brand: 'Lenovo', description: 'Real', price: 150000, mrp: 160000, category: laptops._id, stock: 2,
});
await call('sa', 'POST', '/api/coupons', { code: 'DIWALI', type: 'flat', value: 100 });
await register('realbuyer');
await call('realbuyer', 'POST', '/api/cart', { productId: mug._id, quantity: 1 });
r = await call('realbuyer', 'POST', '/api/orders', { shippingAddress: ADDRESS });
const realOrder = r.body.order._id;
const demo = await Product.findOne({ name: 'Dell Inspiron 15' });
await call('realbuyer', 'POST', `/api/wishlist/${demo._id}`);

console.log('--- dry run ---');
const lines = [];
const dry = await purgeDemoData({ log: (l) => lines.push(l) });
expect('dry run changes nothing', await Product.countDocuments({ name: 'Dell Inspiron 15' }), 1);
expect('dry run counts 24 demo products', dry.counts.products, 24);
expect('dry run says how to apply', lines.some((l) => l.includes('--yes')), true);

console.log('\n--- apply ---');
await purgeDemoData({ apply: true, log: () => {} });
expect('demo products gone', await Product.countDocuments({ name: 'Dell Inspiron 15' }), 0);
expect('demo customers gone', await User.countDocuments({ email: /@example\.com$/ }), 0);
expect('demo coupons gone', await Coupon.countDocuments({ code: 'WELCOME10' }), 0);
expect('only real orders left', await Order.countDocuments(), 1);
expect('real order kept', String((await Order.findOne())._id), realOrder);
expect('real products kept', await Product.countDocuments(), 2);
expect('real coupon kept', await Coupon.countDocuments({ code: 'DIWALI' }), 1);
expect('staff kept', await User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }), 2);
expect('real customer kept', await User.countDocuments({ email: 'realbuyer@test.com' }), 1);
expect('demo category still in use is kept', await Category.countDocuments({ name: 'Laptops' }), 1);
expect('unused demo category removed', await Category.countDocuments({ name: 'Smartphones' }), 0);
expect('real category kept', await Category.countDocuments({ name: 'Handmade Pottery' }), 1);
r = await call('realbuyer', 'GET', '/api/wishlist');
expect('demo product pulled from real wishlist', r.body.wishlist.count, 0);

const again = await purgeDemoData({ apply: true, log: () => {} });
expect('second run finds nothing', again.counts.products + again.counts.orders, 0);

await finish();
