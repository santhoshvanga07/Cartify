/**
 * Regression tests for the bug-fix round: product editing and slugs,
 * categories, shop filters, input validation, analytics and staff e-mail
 * normalisation. Run with: npm run test:fixes
 */
import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import Category from './src/models/Category.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('shopper');

const laptops = await Category.findOne({ name: 'Laptops' });
const newProduct = (extra = {}) => call('sa', 'POST', '/api/products', {
  name: 'Test Lamp', brand: 'Lumen', description: 'A lamp', price: 1000, mrp: 1200,
  category: laptops._id, stock: 10, ...extra,
});

console.log('--- editing a product does not undo sales ---');
let r = await newProduct();
const lamp = r.body.product;
// Three units sell while the admin has the edit form open (form still says 10).
await Product.updateOne({ _id: lamp._id }, { $inc: { stock: -3 } });
r = await call('sa', 'PUT', `/api/products/${lamp._id}`, { description: 'A better lamp', stock: 15, stockWas: 10 });
expect('edit saved', r.status, 200);
expect('admin added 5 to the 7 really left', (await Product.findById(lamp._id)).stock, 12);
r = await call('sa', 'PUT', `/api/products/${lamp._id}`, { description: 'Same stock', stock: 10, stockWas: 10 });
expect('untouched stock field changes nothing', (await Product.findById(lamp._id)).stock, 12);
r = await call('sa', 'PUT', `/api/products/${lamp._id}`, { stock: 0, stockWas: 100 });
expect('a change that would go below zero is refused', r.status, 409, `"${r.body.message}"`);

console.log('\n--- product validation ---');
r = await newProduct({ name: 'Cheap MRP', mrp: 500 });
expect('MRP below price rejected', r.status, 400, `"${r.body.message}"`);
r = await newProduct({ name: 'Half Stock', stock: 2.5 });
expect('fractional stock rejected', r.status, 400, `"${r.body.message}"`);
r = await newProduct({ name: 'Spec Dots', attributes: { 'No. of cores': '8', $bad: 'x' } });
expect('spec name with a dot saves', r.status, 201, `"${r.body.message}"`);
expect('  stored without the dot', r.body.product?.attributes?.['No of cores'], '8');

console.log('\n--- slugs ---');
r = await newProduct();
expect('second product with the same name is allowed', r.status, 201, `"${r.body.message}"`);
expect('  and gets its own slug', r.body.product?.slug !== lamp.slug && r.body.product?.slug?.startsWith('test-lamp-'), true);
r = await newProduct({ name: 'कुर्ता' });
expect('name without Latin letters still gets a slug', Boolean(r.body.product?.slug), true);
r = await call('sa', 'PUT', `/api/products/${lamp._id}`, { name: 'Renamed Lamp' });
expect('renaming keeps the slug (old order links keep working)', r.body.product?.slug, lamp.slug);

console.log('\n--- admin product list ---');
await call('sa', 'DELETE', `/api/products/${lamp._id}`);
r = await call('sa', 'GET', '/api/products/admin/list?status=removed');
expect('removed products are listed for admins', r.body.products?.some((p) => p._id === lamp._id), true);
r = await call('shopper', 'GET', '/api/products/admin/list');
expect('customers cannot use the admin list', r.status, 403);
r = await call('sa', 'PUT', `/api/products/${lamp._id}`, { isActive: true });
expect('removed product can be restored', r.body.product?.isActive, true);

console.log('\n--- categories ---');
r = await call('sa', 'POST', '/api/categories', { name: 'Garden' });
const garden = r.body.category;
await call('sa', 'DELETE', `/api/categories/${garden._id}`);
r = await call('sa', 'POST', '/api/categories', { name: 'Garden', description: 'Back again' });
expect('a deleted category can be created again', r.status, 201, `"${r.body.message}"`);
expect('  (it is restored, not duplicated)', r.body.category?._id, garden._id);
r = await call('sa', 'PUT', `/api/categories/${laptops._id}`, { isActive: false });
expect('update cannot hide a category in use', (await Category.findById(laptops._id)).isActive, true);

console.log('\n--- shop filters and odd input ---');
const all = (await call(null, 'GET', '/api/products?limit=50')).body.total;
r = await call(null, 'GET', '/api/products?limit=50&inStockOnly=false');
expect('inStockOnly=false does not hide sold-out items', r.body.total, all);
r = await call(null, 'GET', '/api/products?limit=50&inStockOnly=true');
expect('inStockOnly=true does', r.body.total < all, true);
r = await call(null, 'GET', '/api/products?q=dell&q=hp');
expect('repeated ?q= is not a server error', r.status, 200);
r = await call(null, 'POST', '/api/ai/compare', { slugA: { $ne: null }, slugB: { $regex: '.' } });
expect('query operators as compare slugs rejected', r.status, 400);
r = await call(null, 'POST', '/api/auth/login', { email: 'shopper@test.com', password: { $gt: '' } });
expect('object as password rejected (not a 500)', r.status, 400);
r = await call('sa', 'GET', '/api/orders?limit=-5&page=2');
expect('negative page size is not a server error', r.status, 200);
const p = await Product.findOne({ stock: { $gt: 5 }, isActive: true });
await call('shopper', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('shopper', 'POST', '/api/orders', { shippingAddress: { ...ADDRESS, phone: 9876543210 } });
expect('number instead of text in the address is a 400', r.status, 400);

console.log('\n--- a cancelled order gives its coupon back ---');
await call('sa', 'POST', '/api/coupons', { code: 'ONCEONLY', type: 'flat', value: 100 });
r = await call('shopper', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'ONCEONLY' });
expect('order with coupon placed', r.status, 201, `"${r.body.message}"`);
await call('shopper', 'PATCH', `/api/orders/${r.body.order?._id}/cancel`);
await call('shopper', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('shopper', 'POST', '/api/orders', { shippingAddress: ADDRESS, couponCode: 'ONCEONLY' });
expect('the coupon works again after cancelling', r.status, 201, `"${r.body.message}"`);

console.log('\n--- AI features still work without an AI key ---');
const hadKey = process.env.GROQ_API_KEY;
delete process.env.GROQ_API_KEY;
r = await call(null, 'POST', '/api/ai/search', { query: 'trekking shoes under 3000' });
expect('assistant understands "under 3000" without AI', r.body.interpretation?.maxPrice, 3000);
expect('  and finds the trekking shoes', r.body.products?.some((x) => x.name === 'Wildcraft Trek Shoes'), true);
r = await call(null, 'POST', '/api/ai/search', { query: 'laptop below 50k' });
expect('  "laptop below 50k" -> laptops category', r.body.interpretation?.category, 'laptops');
r = await call(null, 'POST', '/api/ai/compare', { slugA: 'dell-inspiron-15', slugB: 'hp-pavilion-14' });
expect('compare answers without AI', r.status, 200);
expect('  with both products for the side-by-side table', Boolean(r.body.products?.A && r.body.products?.B), true);
expect('  and says the AI verdict is unavailable', r.body.aiUnavailable, true);
if (hadKey) process.env.GROQ_API_KEY = hadKey;

console.log('\n--- analytics ---');
r = await call('sa', 'GET', '/api/analytics/sales?days=30');
expect('sales series has every one of the 30 days', r.body.series?.length, 30);
r = await call('sa', 'GET', '/api/analytics/customer-growth');
expect('customer growth answers', r.status, 200);
const last = r.body.series?.at(-1);
expect('  running total ends at the real customer count', last?.total, (await call('sa', 'GET', '/api/analytics/overview')).body.totals.customers);

console.log('\n--- staff with a Gmail address can sign in ---');
process.env.SEED_ADMIN_EMAIL = 'Store.Owner+shop@gmail.com';
process.env.SEED_ADMIN_PASSWORD = 'password123';
await ensureSuperAdmin();
r = await call('owner', 'POST', '/api/auth/login', { email: 'Store.Owner+shop@gmail.com', password: 'password123' });
expect('seeded Gmail admin can log in', r.status, 200, `"${r.body.message || r.body.user?.email}"`);

await finish();
