import { startHarness, ADDRESS } from './_harness.mjs';
import { outbox } from './src/services/email.service.js';
import Product from './src/models/Product.js';
import User from './src/models/User.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();

const lastMailTo = (email) => [...outbox].reverse().find((m) => m.to === email);
const recentSubjectsTo = (email, n = 3) => outbox.filter((m) => m.to === email).slice(-n).map((m) => m.subject);
const tick = () => new Promise((r) => setTimeout(r, 50)); // let fire-and-forget emails land

console.log('--- welcome email ---');
await register('kim', 'Kim');
await tick();
expect('welcome email sent on register', lastMailTo('kim@test.com')?.subject, 'Welcome to Cartify');

console.log('\n--- profile ---');
let r = await call('kim', 'PUT', '/api/auth/me', { name: 'Kim Lee', role: 'superadmin', isActive: false });
expect('name updated', r.body.user?.name, 'Kim Lee');
expect('role cannot be changed via profile', r.body.user?.role, 'customer');
r = await call('kim', 'PUT', '/api/auth/me', { name: '' });
expect('empty name rejected', r.status, 400);

console.log('\n--- change password ---');
// A second "device" signed in with the old password.
r = await call('kimPhone', 'POST', '/api/auth/login', { email: 'kim@test.com', password: 'password123' });
expect('second device signed in', r.status, 200);

// JWT iat has one-second resolution; make sure the change is a later second.
await new Promise((res) => setTimeout(res, 1100));

r = await call('kim', 'PUT', '/api/auth/password', { currentPassword: 'wrong-one', newPassword: 'newpassword1' });
expect('wrong current password rejected', r.status, 401);
r = await call('kim', 'PUT', '/api/auth/password', { currentPassword: 'password123', newPassword: 'short' });
expect('short new password rejected', r.status, 400);
r = await call('kim', 'PUT', '/api/auth/password', { currentPassword: 'password123', newPassword: 'newpassword1' });
expect('password changed', r.status, 200);

r = await call('kim', 'GET', '/api/auth/me');
expect('this device stays signed in (fresh cookie)', r.status, 200);
r = await call('kimPhone', 'GET', '/api/auth/me');
expect('other device is signed out', r.status, 401, `"${r.body.message}"`);
r = await call('x', 'POST', '/api/auth/login', { email: 'kim@test.com', password: 'newpassword1' });
expect('new password works', r.status, 200);
await tick();
// Signing in right after sends a sign-in alert, so look a few emails back.
expect('password-changed email sent', recentSubjectsTo('kim@test.com').includes('Your Cartify password was changed'), true);
const signIn = lastMailTo('kim@test.com');
expect('sign-in alert sent on login', signIn?.subject, 'New sign-in to your Cartify account');
expect('  it says when it happened (IST)', /IST/.test(signIn?.text || ''), true);
expect('  and links to reset the password', signIn?.text.includes('/forgot-password'), true);
r = await call('x', 'POST', '/api/auth/login', { email: 'kim@test.com', password: 'wrong-password' });
expect('no sign-in alert for a failed attempt', lastMailTo('kim@test.com') === signIn, true);

console.log('\n--- forgot / reset ---');
r = await call(null, 'POST', '/api/auth/forgot-password', { email: 'nobody@test.com' });
const unknownMsg = r.body.message;
expect('unknown email still 200', r.status, 200);
r = await call(null, 'POST', '/api/auth/forgot-password', { email: 'kim@test.com' });
expect('same answer for a real account', r.body.message, unknownMsg);
await tick();
const mail = lastMailTo('kim@test.com');
expect('reset email sent', mail?.subject, 'Reset your Cartify password');
const token = mail.text.match(/reset-password\/([a-f0-9]{64})/)?.[1];
expect('email carries a 64-char token', token?.length, 64);

const stored = await User.findOne({ email: 'kim@test.com' }).select('+resetPasswordToken');
expect('raw token is NOT stored', stored.resetPasswordToken === token, false);

r = await call(null, 'POST', '/api/auth/reset-password/deadbeef', { password: 'whatever123' });
expect('bogus token rejected', r.status, 400);
r = await call('kimReset', 'POST', `/api/auth/reset-password/${token}`, { password: 'resetpass99' });
expect('valid token resets password', r.status, 200);
r = await call(null, 'POST', `/api/auth/reset-password/${token}`, { password: 'again12345' });
expect('token is single-use', r.status, 400);
r = await call('y', 'POST', '/api/auth/login', { email: 'kim@test.com', password: 'resetpass99' });
expect('can log in with reset password', r.status, 200);

await call(null, 'POST', '/api/auth/forgot-password', { email: 'kim@test.com' });
await tick();
const token2 = lastMailTo('kim@test.com').text.match(/reset-password\/([a-f0-9]{64})/)[1];
await User.updateOne({ email: 'kim@test.com' }, { resetPasswordExpire: new Date(Date.now() - 1000) });
r = await call(null, 'POST', `/api/auth/reset-password/${token2}`, { password: 'expired123' });
expect('expired token rejected', r.status, 400);

console.log('\n--- order emails ---');
const p = await Product.findOne({ stock: { $gt: 5 } });
await call('y', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('y', 'POST', '/api/orders', { shippingAddress: { ...ADDRESS, fullName: '<b>Kim</b>' } });
await tick();
const orderMail = lastMailTo('kim@test.com');
expect('order confirmation sent', orderMail?.subject, `Order ${r.body.order.orderNumber} confirmed`);
expect('  lists the items', orderMail?.text.includes(p.name), true);
expect('  shows the total', orderMail?.text.includes('Total: Rs'), true);
expect('  shows the delivery address', orderMail?.text.includes('Delivering to:'), true);
expect('  shows the payment method', orderMail?.text.includes('Cash on delivery'), true);
expect('staff alerted', lastMailTo(process.env.SEED_SUPERADMIN_EMAIL)?.subject.startsWith('[Cartify admin] New order'), true);

await call('sa', 'PATCH', `/api/orders/${r.body.order._id}/status`, { status: 'confirmed' });
await call('sa', 'PATCH', `/api/orders/${r.body.order._id}/status`, { status: 'shipped' });
await tick();
expect('shipping email sent', lastMailTo('kim@test.com')?.subject, `Order ${r.body.order.orderNumber} shipped`);

console.log('\n--- html escaping ---');
await call('evil', 'POST', '/api/auth/register', { name: '<script>x</script>', email: 'evil@test.com', password: 'password123' });
await tick();
expect('names are escaped in email html', lastMailTo('evil@test.com')?.html.includes('<script>'), false);

await finish();
