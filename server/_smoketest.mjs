import 'dotenv/config';
import app from './src/app.js';

const PORT = 5099;
const base = `http://localhost:${PORT}`;
const server = app.listen(PORT);

const hit = async (label, path, opts = {}) => {
  const r = await fetch(base + path, opts);
  let body; try { body = await r.json(); } catch { body = '<non-json>'; }
  console.log(`${String(r.status).padEnd(4)} ${label}`);
  console.log(`     ${JSON.stringify(body).slice(0, 110)}`);
  return r;
};

console.log('--- headers ---');
const h = await fetch(base + '/api/health');
console.log('X-Powered-By      :', h.headers.get('x-powered-by') ?? '(removed by helmet)');
console.log('X-Content-Type-Opt:', h.headers.get('x-content-type-options'));
console.log('X-Frame-Options   :', h.headers.get('x-frame-options'));
console.log('Strict-Transport  :', h.headers.get('strict-transport-security'));

console.log('\n--- routing & auth (no DB needed) ---');
await hit('GET  /api/nope            (expect 404)', '/api/nope');
await hit('GET  /api/auth/me no cookie (expect 401)', '/api/auth/me');
await hit('GET  /api/auth/me bad token (expect 401)', '/api/auth/me', {
  headers: { Cookie: 'token=not.a.real.jwt' },
});

console.log('\n--- input validation (expect 400) ---');
const post = (b) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
await hit('register: bad email', '/api/auth/register', post({ name: 'A', email: 'nope', password: 'password123' }));
await hit('register: short password', '/api/auth/register', post({ name: 'A', email: 'a@b.com', password: 'abc' }));

// Rate limiting has its own suite now, with its own numbers:
//   npm run test:ratelimit

server.close();
