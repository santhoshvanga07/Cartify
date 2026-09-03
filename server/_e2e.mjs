import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import User from './src/models/User.js';

await connectDB();

// --- seed the first Super Admin (same logic as npm run seed:admin) ---
const sa = await User.create({
  name: process.env.SEED_SUPERADMIN_NAME,
  email: process.env.SEED_SUPERADMIN_EMAIL,
  password: process.env.SEED_SUPERADMIN_PASSWORD,
  role: 'superadmin',
});
console.log(`seeded Super Admin: ${sa.email}\n`);

const PORT = 5099, base = `http://localhost:${PORT}`;
const server = app.listen(PORT);
const jar = {};
let pass = 0, fail = 0;

const call = async (as, method, path, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (as && jar[as]) headers.Cookie = jar[as];
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  const t = sc.find((c) => c.startsWith('token=') && !c.startsWith('token=;'));
  if (t && as) jar[as] = t.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const expect = (label, actual, wanted, extra = '') => {
  const ok = actual === wanted;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`      expected ${wanted}, got ${actual}${extra ? '  ' + extra : ''}`);
};

console.log('--- authentication ---');
let r = await call('sa', 'POST', '/api/auth/login', {
  email: process.env.SEED_SUPERADMIN_EMAIL,
  password: process.env.SEED_SUPERADMIN_PASSWORD,
});
expect('Super Admin can log in', r.status, 200, `role=${r.body.user?.role}`);

console.log('\n--- mass assignment defence ---');
r = await call('cust', 'POST', '/api/auth/register', {
  name: 'Attacker', email: 'cust@cartify.com', password: 'password123', role: 'superadmin',
});
expect('register ignores injected role', r.body.user?.role, 'customer', '(sent role=superadmin)');

console.log('\n--- authorization (RBAC) ---');
r = await call('cust', 'GET', '/api/users');
expect('customer BLOCKED from user list', r.status, 403, `"${r.body.message}"`);

r = await call('sa', 'GET', '/api/users');
expect('Super Admin can read user list', r.status, 200, `count=${r.body.count}`);

r = await call('sa', 'POST', '/api/users/admins', {
  name: 'Store Admin', email: 'admin@cartify.com', password: 'password123',
});
expect('Super Admin can create an admin', r.status, 201, `role=${r.body.user?.role}`);
const adminId = r.body.user?._id;

console.log('\n--- self-protection guards ---');
r = await call('sa', 'PATCH', `/api/users/${sa._id}/status`, { isActive: false });
expect('Super Admin cannot suspend self', r.status, 400, `"${r.body.message}"`);

console.log('\n--- suspension takes effect immediately ---');
const cust = await User.findOne({ email: 'cust@cartify.com' });
r = await call('sa', 'PATCH', `/api/users/${cust._id}/status`, { isActive: false });
expect('Super Admin suspends the customer', r.status, 200, `"${r.body.message}"`);

r = await call('cust', 'GET', '/api/auth/me');
expect('suspended user rejected on EXISTING cookie', r.status, 403, `"${r.body.message}"`);

r = await call('cust2', 'POST', '/api/auth/login', {
  email: 'cust@cartify.com', password: 'password123',
});
expect('suspended user cannot log back in', r.status, 403, `"${r.body.message}"`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
console.log('final users:', (await User.find().select('email role isActive'))
  .map((u) => `${u.email} [${u.role}]${u.isActive ? '' : ' SUSPENDED'}`).join('\n              '));

server.close();
await mongoose.connection.close();
process.exit(fail ? 1 : 0);
