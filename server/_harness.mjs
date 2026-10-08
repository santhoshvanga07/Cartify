/**
 * Shared set-up for the newer test scripts: a fresh database, the seeded
 * catalogue, an API server on a spare port and a cookie jar per actor.
 */
import 'dotenv/config';
import connectDB, { disconnectDB } from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './src/utils/seedCatalog.js';

export const ADDRESS = {
  fullName: 'Test Buyer', phone: '9876543210', line1: '12 MG Road',
  city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
};

export const startHarness = async (port = 5099) => {
  await connectDB();
  await ensureSuperAdmin();
  await seedCatalog();

  const server = app.listen(port);
  const base = `http://localhost:${port}`;
  const jars = {};
  let pass = 0, fail = 0;

  const call = async (as, method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (jars[as]) headers.Cookie = jars[as];
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const t = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('token=') && !c.startsWith('token=;'));
    if (t && as) jars[as] = t.split(';')[0];
    const type = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, body: type.includes('json') ? await r.json() : await r.text() };
  };

  const expect = (label, actual, wanted, extra = '') => {
    const ok = actual === wanted;
    ok ? pass++ : fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (want ${wanted}, got ${actual}) ${extra}`);
  };

  const loginSuperAdmin = () =>
    call('sa', 'POST', '/api/auth/login', {
      email: process.env.SEED_SUPERADMIN_EMAIL,
      password: process.env.SEED_SUPERADMIN_PASSWORD,
    });

  const register = (as, name = as) =>
    call(as, 'POST', '/api/auth/register', { name, email: `${as}@test.com`, password: 'password123' });

  const finish = async () => {
    console.log(`\n=== ${pass} passed, ${fail} failed ===`);
    server.close();
    await disconnectDB();
    process.exit(fail ? 1 : 0);
  };

  return { call, expect, loginSuperAdmin, register, finish };
};
