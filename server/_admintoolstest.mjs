import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import ActivityLog from './src/models/ActivityLog.js';
import { toCsv } from './src/utils/csv.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await call('admin', 'POST', '/api/auth/login', {
  email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD,
});
await register('buyer');
const tick = () => new Promise((r) => setTimeout(r, 100));

const p = await Product.findOne({ stock: { $gt: 5 }, price: { $gt: 1000, $lt: 4000 } });

console.log('--- settings access ---');
let r = await call(null, 'GET', '/api/settings/public');
expect('public settings readable by anyone', r.body.settings?.gstRate, 18);
expect('public settings omit admin fields', 'updatedBy' in (r.body.settings || {}), false);
r = await call('admin', 'GET', '/api/settings');
expect('plain admin cannot read full settings', r.status, 403);
r = await call('admin', 'PUT', '/api/settings', { gstRate: 0 });
expect('plain admin cannot change settings', r.status, 403);

console.log('\n--- settings change pricing ---');
await call('buyer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('buyer', 'GET', '/api/cart');
expect('default GST is 18%', r.body.cart.totals.gst, Math.round(p.price * 0.18 * 100) / 100);
expect('shipping charged below threshold', r.body.cart.totals.shipping, 99);

r = await call('sa', 'PUT', '/api/settings', { gstRate: 12, shippingFlat: 49, freeShippingAbove: 1000, storeName: 'Cartify Test' });
expect('super admin updates settings', r.status, 200);
r = await call('buyer', 'GET', '/api/cart');
expect('new GST rate applies immediately', r.body.cart.totals.gst, Math.round(p.price * 0.12 * 100) / 100);
expect('totals report the rate', r.body.cart.totals.gstRate, 12);
expect('new free-shipping threshold applies', r.body.cart.totals.shipping, 0);

r = await call('buyer', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('order stores the GST rate it was charged', r.body.order?.pricing?.gstRate, 12);
const orderId = r.body.order._id;

r = await call('sa', 'PUT', '/api/settings', { gstRate: 99 });
expect('out-of-range GST rejected', r.status, 400);
r = await call('sa', 'PUT', '/api/settings', { gstin: 'bad' });
expect('malformed GSTIN rejected', r.status, 400);
r = await call('sa', 'PUT', '/api/settings', { codEnabled: false, onlinePaymentEnabled: false });
expect('cannot disable every payment method', r.status, 400);

r = await call('sa', 'PUT', '/api/settings', { codEnabled: false });
await call('buyer', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('buyer', 'POST', '/api/orders', { shippingAddress: ADDRESS, paymentMethod: 'cod' });
expect('COD refused when disabled', r.status, 400, `"${r.body.message}"`);
r = await call(null, 'GET', '/api/payments/config');
expect('payment config reports COD off', r.body.cod, false);
await call('sa', 'PUT', '/api/settings', { codEnabled: true, gstRate: 18, shippingFlat: 99, freeShippingAbove: 5000 });

console.log('\n--- activity log ---');
await call('x', 'POST', '/api/auth/login', { email: 'buyer@test.com', password: 'wrong-password' });
await call('sa', 'PATCH', `/api/orders/${orderId}/status`, { status: 'confirmed' });
await tick();

r = await call('admin', 'GET', '/api/settings/activity');
expect('plain admin cannot read the audit log', r.status, 403);
r = await call('sa', 'GET', '/api/settings/activity?action=auth');
expect('auth events recorded', r.body.logs?.some((l) => l.action === 'auth.login'), true);
const failed = r.body.logs.find((l) => l.action === 'auth.login_failed');
expect('failed login recorded with the attempted email', failed?.target?.label, 'buyer@test.com');
expect('failed login has no actor', failed?.actor, undefined);
expect('only auth.* returned for the prefix', r.body.logs.every((l) => l.action.startsWith('auth.')), true);

r = await call('sa', 'GET', '/api/settings/activity?action=settings');
expect('settings change recorded with a diff', r.body.logs?.[0]?.details.includes('gstRate'), true);
r = await call('sa', 'GET', '/api/settings/activity?action=order.status');
expect('order status change recorded', r.body.logs?.[0]?.details, 'placed -> confirmed');

r = await call('sa', 'GET', '/api/settings/activity?action=' + encodeURIComponent('.*'));
expect('action filter cannot inject a regex', r.status, 200);
expect('audit log has no delete endpoint', (await call('sa', 'DELETE', '/api/settings/activity')).status, 404);
expect('entries carry an IP', Boolean((await ActivityLog.findOne({ action: 'auth.login' })).ip), true);

console.log('\n--- reports ---');
r = await call('buyer', 'GET', '/api/reports/sales');
expect('customers cannot read reports', r.status, 403);
r = await call('admin', 'GET', '/api/reports/sales');
expect('admin gets sales JSON', r.status, 200);
expect('sales summary counts the order', r.body.summary?.orders >= 1, true);
r = await call('admin', 'GET', '/api/reports/sales?from=2026-12-01&to=2026-01-01');
expect('reversed range rejected', r.status, 400);
r = await call('admin', 'GET', '/api/reports/sales?from=2020-01-01&to=2026-01-01');
expect('range over a year rejected', r.status, 400);

r = await call('admin', 'GET', '/api/reports/orders?format=csv');
expect('orders CSV content type', r.headers.get('content-type')?.startsWith('text/csv'), true);
expect('CSV is a download', r.headers.get('content-disposition')?.includes('attachment'), true);
expect('CSV has a header row', r.body.replace('﻿', '').startsWith('Order,Placed at,Customer'), true);

r = await call('admin', 'GET', '/api/reports/products');
expect('products report includes unsold products', r.body.rows?.some((x) => x.units === 0), true);
const sold = r.body.rows?.find((x) => x.name === p.name);
expect('units sold counted', sold?.units >= 1, true);

console.log('\n--- CSV safety ---');
const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: '=HYPERLINK("x")', b: 'Hello, "world"' }, { a: -5, b: '-5' }]);
expect('formula neutralised', csv.includes(`"'=HYPERLINK(""x"")"`), true);
expect('commas and quotes escaped', csv.includes('"Hello, ""world"""'), true);
expect('negative numbers stay numbers', csv.split('\r\n')[2].startsWith('-5,'), true);
expect('negative-looking text is neutralised', csv.split('\r\n')[2].endsWith(",'-5"), true);

await finish();
