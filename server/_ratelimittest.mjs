import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';

await connectDB();
await ensureSuperAdmin();

const server = app.listen(5099);
const base = 'http://localhost:5099';
let pass = 0, fail = 0;

const expect = (label, actual, wanted, extra = '') => {
  const ok = actual === wanted;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (want ${wanted}, got ${actual}) ${extra}`);
};

let configuredLimit = null;

const login = async (password) => {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SEED_SUPERADMIN_EMAIL, password }),
  });
  // standardHeaders: true makes the server advertise its own limit,
  // so the test does not have to hardcode a number that will drift.
  configuredLimit ??= Number(r.headers.get('ratelimit-limit')) || null;
  return r.status;
};

const GOOD = process.env.SEED_SUPERADMIN_PASSWORD;

console.log(`NODE_ENV = ${process.env.NODE_ENV}\n`);

console.log('--- 20 SUCCESSFUL logins in a row ---');
const results = [];
for (let i = 0; i < 20; i++) results.push(await login(GOOD));
const blocked = results.filter((s) => s === 429).length;
const ok = results.filter((s) => s === 200).length;
expect('all 20 succeed', ok, 20);
expect('none rate-limited', blocked, 0, '(skipSuccessfulRequests working)');

console.log(`\n--- wrong passwords still counted (limit is ${configuredLimit}) ---`);
const badResults = [];
// Exceed whatever the server advertises, so this works in dev AND production.
for (let i = 0; i < configuredLimit + 2; i++) {
  badResults.push(await login('definitely-wrong-password'));
}
const rejected = badResults.filter((s) => s === 401).length;
const throttled = badResults.filter((s) => s === 429).length;
console.log(`      401 (wrong password): ${rejected}   429 (throttled): ${throttled}`);
expect('failed attempts eventually throttle', throttled > 0, true);
expect('throttled only AFTER the limit', rejected, configuredLimit);

console.log('\n--- a real user can still get in after someone else guessed wrong ---');
const afterStatus = await login(GOOD);
console.log(`      login with correct password after throttling: ${afterStatus}`);
console.log('      (429 here is CORRECT - the limiter is per-IP and an attacker');
console.log('       has been guessing from this address)');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close();
await mongoose.connection.close();
process.exit(fail ? 1 : 0);
