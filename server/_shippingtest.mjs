/**
 * Courier details on shipping, low-stock alerts to staff, and the contact form.
 * Run with: npm run test:shipping
 */
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';
import { startHarness, ADDRESS } from './_harness.mjs';
import Product from './src/models/Product.js';
import { outbox } from './src/services/email.service.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('cara');
const tick = () => new Promise((r) => setTimeout(r, 50));
const mailsTo = (email) => outbox.filter((m) => m.to === email);

const p = await Product.findOne({ 'variants.0': { $exists: false }, stock: { $gt: 10 } });
const placeOrder = async (qty = 1) => {
  await call('cara', 'POST', '/api/cart', { productId: p._id, quantity: qty });
  return (await call('cara', 'POST', '/api/orders', { shippingAddress: ADDRESS })).body.order;
};

console.log('--- marking an order shipped with courier details ---');
let order = await placeOrder();
await call('sa', 'PATCH', `/api/orders/${order._id}/status`, { status: 'confirmed' });
let r = await call('sa', 'PATCH', `/api/orders/${order._id}/status`, {
  status: 'shipped', shipment: { courier: 'Delhivery', trackingNumber: 'DL123', trackingUrl: 'javascript:alert(1)' },
});
expect('a javascript: tracking link is refused', r.status, 400, `"${r.body.message}"`);
r = await call('sa', 'GET', `/api/orders/${order._id}`);
expect('  and the order did not move', r.body.order?.status, 'confirmed');
r = await call('sa', 'PATCH', `/api/orders/${order._id}/status`, {
  status: 'shipped',
  shipment: { courier: 'Delhivery', trackingNumber: 'DL123456', trackingUrl: 'https://www.delhivery.com/track/package/DL123456', expectedDelivery: '2026-11-20' },
});
expect('shipped with courier details', r.status, 200, `"${r.body.message}"`);
expect('  courier stored', r.body.order?.shipment?.courier, 'Delhivery');
expect('  tracking number stored', r.body.order?.shipment?.trackingNumber, 'DL123456');
expect('  expected date stored (IST)', new Date(r.body.order?.shipment?.expectedDelivery).toISOString().slice(0, 10), '2026-11-20');
expect('  history says how it shipped', r.body.order?.statusHistory?.at(-1)?.note, 'Shipped with Delhivery (DL123456)');
await tick();
const shippedMail = mailsTo('cara@test.com').find((m) => m.subject === `Order ${order.orderNumber} shipped`);
expect('shipped email has the courier', shippedMail?.text.includes('Courier: Delhivery'), true);
expect('  the tracking number', shippedMail?.text.includes('Tracking number: DL123456'), true);
expect('  the expected delivery date', /Expected delivery: .*20 November/.test(shippedMail?.text || ''), true);
expect('  and a tracking button', shippedMail?.html.includes('Track your parcel'), true);
r = await call('cara', 'GET', `/api/orders/${order._id}`);
expect('customer sees the tracking details', r.body.order?.shipment?.trackingNumber, 'DL123456');

order = await placeOrder();
await call('sa', 'PATCH', `/api/orders/${order._id}/status`, { status: 'confirmed' });
r = await call('sa', 'PATCH', `/api/orders/${order._id}/status`, { status: 'shipped' });
expect('shipping without details still works', r.status, 200);
const eta = (new Date(r.body.order?.shipment?.expectedDelivery) - new Date(r.body.order?.shipment?.shippedAt)) / 86400000;
expect('  and promises the usual 5 days', Math.round(eta), 5);

console.log('\n--- low-stock alert ---');
await Product.updateOne({ _id: p._id }, { stock: 7 });
const staffBefore = mailsTo(process.env.SEED_SUPERADMIN_EMAIL).filter((m) => m.subject.includes('Low stock')).length;
await placeOrder(1); // 6 left: not low yet
await tick();
expect('no alert above the line', mailsTo(process.env.SEED_SUPERADMIN_EMAIL).filter((m) => m.subject.includes('Low stock')).length, staffBefore);
await placeOrder(2); // 4 left: crossed the line
await tick();
const lowMails = mailsTo(process.env.SEED_SUPERADMIN_EMAIL).filter((m) => m.subject.includes('Low stock'));
expect('staff alerted when stock falls to 5 or less', lowMails.length, staffBefore + 1);
expect('  the alert says how many are left', lowMails.at(-1)?.text.includes('Only 4 of'), true);
await placeOrder(1); // 3 left: already low, no repeat
await tick();
expect('no repeat alert on the next sale', mailsTo(process.env.SEED_SUPERADMIN_EMAIL).filter((m) => m.subject.includes('Low stock')).length, staffBefore + 1);

console.log('\n--- contact form ---');
r = await call(null, 'POST', '/api/contact', { name: 'Ravi', email: 'ravi@test.com', message: 'Hi' });
expect('a too-short message is refused', r.status, 400, `"${r.body.message}"`);
r = await call(null, 'POST', '/api/contact', { name: 'Ravi', email: 'not-an-email', message: 'Where is my parcel please?' });
expect('a bad email is refused', r.status, 400);
r = await call(null, 'POST', '/api/contact', {
  name: '<b>Ravi</b>', email: 'ravi@test.com', orderNumber: 'CFY-1', message: 'Where is my parcel please? <script>x</script>',
});
expect('a good message is accepted', r.status, 200, `"${r.body.message}"`);
await tick();
const toStaff = mailsTo(process.env.SEED_SUPERADMIN_EMAIL).at(-1);
expect('staff get the message', toStaff?.subject, '[Cartify admin] Message from <b>Ravi</b> about order CFY-1');
expect('  with the reply-to address', toStaff?.text.includes('ravi@test.com'), true);
expect('  and it is escaped in HTML', toStaff?.html.includes('<script>'), false);
expect('the sender gets a copy', mailsTo('ravi@test.com').at(-1)?.subject, 'We have your message');

await finish();
