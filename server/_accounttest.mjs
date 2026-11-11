// These scripts register throwaway customers and order straight away; the
// email-confirmation step itself is tested in _accounttest.
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';
import { startHarness, ADDRESS } from './_harness.mjs';
import { outbox } from './src/services/email.service.js';
import { setDnsResolver } from './src/utils/emailCheck.js';
import Product from './src/models/Product.js';
import User from './src/models/User.js';

const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();

const lastMailTo = (email) => [...outbox].reverse().find((m) => m.to === email);
const mailsTo = (email) => outbox.filter((m) => m.to === email);
const recentSubjectsTo = (email, n = 3) => outbox.filter((m) => m.to === email).slice(-n).map((m) => m.subject);
const tick = () => new Promise((r) => setTimeout(r, 50)); // let fire-and-forget emails land

console.log('--- welcome email ---');
await register('kim', 'Kim');
await tick();
expect('welcome email sent on register', lastMailTo('kim@test.com')?.subject, 'Welcome to Cartify');
expect('  with no confirm link (sign-up uses a code instead)', /verify-email/.test(lastMailTo('kim@test.com')?.text || ''), false);

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

console.log('\n--- sign-up checks the email really exists ---');
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.EMAIL_DOMAIN_CHECK = 'true'; // on, whatever the local .env says - DNS is faked below
// Answer DNS questions without a network: normal domains accept mail, these do not.
setDnsResolver({
  resolveMx: async (d) => {
    if (d === 'no-such-domain.test') throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
    if (d === 'no-mail.test') return [{ exchange: '', priority: 0 }]; // "null MX"
    if (d === 'slow-dns.test') throw Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
    return [{ exchange: `mx.${d}`, priority: 10 }];
  },
  resolve4: async (d) => {
    throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
  },
});
const signUp = (as, email) => call(as, 'POST', '/api/auth/register', { name: 'New Shopper', email, password: 'password123' });

r = await signUp('t1', 'someone@gmial.com');
expect('a typo in the domain is caught', r.status, 400, `"${r.body.message}"`);
expect('  with a suggestion', r.body.suggestion, 'someone@gmail.com');
r = await signUp('t2', 'someone@mailinator.com');
expect('throwaway inboxes are refused', r.status, 400, `"${r.body.message}"`);
r = await signUp('t3', 'someone@no-such-domain.test');
expect('a domain that does not exist is refused', r.status, 400, `"${r.body.message}"`);
r = await signUp('t4', 'someone@no-mail.test');
expect('a domain that accepts no mail is refused', r.status, 400, `"${r.body.message}"`);
r = await signUp('t5', 'kim@test.com');
expect('an email that already has an account is refused', r.status, 409, `"${r.body.message}"`);
r = await signUp('t6', 'someone@slow-dns.test');
expect('a slow DNS server does not block sign-up (the code still decides)', r.status, 202);

r = await signUp('newbie', 'newbie@test.com');
expect('a good address gets a code, not an account', r.status, 202, `"${r.body.message}"`);
expect('  no account exists yet', Boolean(await User.exists({ email: 'newbie@test.com' })), false);
expect('  not signed in yet', (await call('newbie', 'GET', '/api/auth/me')).status, 401);
await tick();
const codeMail = lastMailTo('newbie@test.com');
expect('the code is emailed', /is your Cartify sign-up code$/.test(codeMail?.subject || ''), true);
const firstCode = codeMail.text.match(/code is (\d{6})/)?.[1];
const wrong = firstCode === '000000' ? '111111' : '000000';
r = await call('newbie', 'POST', '/api/auth/register/verify', { email: 'newbie@test.com', code: wrong });
expect('a wrong code is refused', r.status, 400, `"${r.body.message}"`);
expect('  and says how many tries are left', r.body.message.includes('4 tries left'), true);
r = await call('newbie', 'POST', '/api/auth/register/resend', { email: 'newbie@test.com' });
expect('a new code needs a short wait', r.status, 429, `"${r.body.message}"`);
r = await call('newbie', 'POST', '/api/auth/register/verify', { email: 'newbie@test.com', code: firstCode });
expect('the right code creates the account', r.status, 201, `"${r.body.message}"`);
expect('  already confirmed', r.body.user?.emailVerified, true);
expect('  and signs them in', (await call('newbie', 'GET', '/api/auth/me')).body.user?.email, 'newbie@test.com');
r = await call(null, 'POST', '/api/auth/register/verify', { email: 'newbie@test.com', code: firstCode });
expect('the code cannot be used twice', r.status, 400);
r = await call('y2', 'POST', '/api/auth/login', { email: 'newbie@test.com', password: 'password123' });
expect('the chosen password works', r.status, 200);
await tick();
expect('a welcome email follows', mailsTo('newbie@test.com').some((m) => m.subject === 'Welcome to Cartify'), true);

const someProduct = await Product.findOne({ stock: { $gt: 5 } });
await call('newbie', 'POST', '/api/cart', { productId: someProduct._id, quantity: 1 });
r = await call('newbie', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('a confirmed new customer can order', r.status, 201, `"${r.body.message}"`);

// Five wrong codes end the attempt.
await signUp('guess', 'guesser@test.com');
for (let i = 0; i < 5; i++) {
  r = await call('guess', 'POST', '/api/auth/register/verify', { email: 'guesser@test.com', code: String(100000 + i) });
}
await tick();
const realCode = lastMailTo('guesser@test.com').text.match(/code is (\d{6})/)[1];
r = await call('guess', 'POST', '/api/auth/register/verify', { email: 'guesser@test.com', code: realCode });
expect('after 5 wrong codes even the right one is refused', r.status, 400, `"${r.body.message}"`);

console.log('\n--- the old confirm-by-link flow is gone ---');
r = await call(null, 'POST', '/api/auth/verify-email/0123456789abcdef');
expect('no confirm-link endpoint any more', r.status, 404);
r = await call('newbie', 'POST', '/api/auth/verify-email/resend');
expect('no "send a new link" endpoint any more', r.status, 404);
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
r = await signUp('quick', 'quick@test.com');
expect('with checking switched off, the account is created at once', r.status, 201);
await call('quick', 'POST', '/api/cart', { productId: someProduct._id, quantity: 1 });
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
r = await call('quick', 'POST', '/api/orders', { shippingAddress: ADDRESS });
expect('  and can order (no separate confirm step)', r.status, 201, `"${r.body.message}"`);
const staff = await User.findOne({ email: process.env.SEED_SUPERADMIN_EMAIL });
expect('staff accounts are confirmed automatically', staff.emailVerified, true);
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';

console.log('\n--- saved addresses ---');
r = await call('newbie', 'GET', '/api/auth/addresses');
expect('address book starts empty', r.body.addresses?.length, 0);
await call('newbie', 'POST', '/api/cart', { productId: someProduct._id, quantity: 1 });
r = await call('newbie', 'POST', '/api/orders', { shippingAddress: ADDRESS, saveAddress: true });
r = await call('newbie', 'GET', '/api/auth/addresses');
expect('"save this address" at checkout saves it', r.body.addresses?.length, 1);
expect('  first saved address is the default', r.body.addresses?.[0]?.isDefault, true);
r = await call('newbie', 'POST', '/api/auth/addresses', { ...ADDRESS });
expect('the same address is not saved twice', r.body.addresses?.length, 1);
r = await call('newbie', 'POST', '/api/auth/addresses', { ...ADDRESS, line1: '7 Park Street', city: 'Kolkata', pincode: '700016' });
expect('a second address can be added', r.body.addresses?.length, 2);
const second = r.body.addresses[1];
r = await call('newbie', 'PATCH', `/api/auth/addresses/${second._id}/default`);
expect('and made the default', r.body.addresses?.find((a) => a._id === second._id)?.isDefault, true);
expect('  only one default', r.body.addresses?.filter((a) => a.isDefault).length, 1);
r = await call('newbie', 'POST', '/api/auth/addresses', { ...ADDRESS, pincode: '12' });
expect('bad pincode refused', r.status, 400);
r = await call('newbie', 'DELETE', `/api/auth/addresses/${second._id}`);
expect('deleting the default makes another one default', r.body.addresses?.[0]?.isDefault, true);
r = await call('y', 'GET', '/api/auth/addresses');
expect("another customer cannot see these addresses", r.body.addresses?.length ?? 0, 0);

console.log('\n--- order emails ---');
const p = await Product.findOne({ stock: { $gt: 5 } });
await call('y', 'POST', '/api/cart', { productId: p._id, quantity: 1 });
r = await call('y', 'POST', '/api/orders', { shippingAddress: { ...ADDRESS, fullName: '<b>Kim</b>' } });
await tick();
const orderMail = lastMailTo('kim@test.com');
expect('order placed email sent', orderMail?.subject, `Order ${r.body.order.orderNumber} placed`);
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
