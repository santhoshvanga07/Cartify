import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './src/utils/seedCatalog.js';
import Product from './src/models/Product.js';

await connectDB(); await ensureSuperAdmin(); await seedCatalog();
const server = app.listen(5099);
const base = 'http://localhost:5099';
let cookie = ''; let pass = 0, fail = 0;

const expect = (l, a, w, x = '') => { const ok = a === w; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  (want ${w}, got ${a}) ${x}`); };

const lr = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.SEED_SUPERADMIN_EMAIL, password: process.env.SEED_SUPERADMIN_PASSWORD }),
});
cookie = (lr.headers.getSetCookie?.() ?? []).find(c => c.startsWith('token='))?.split(';')[0];

const product = await Product.findOne({ slug: 'dell-inspiron-15' });

// A real 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const post = async (buf, filename, type, jar = cookie) => {
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type }), filename);
  const r = await fetch(`${base}/api/products/${product._id}/images`, {
    method: 'POST', headers: jar ? { Cookie: jar } : {}, body: fd,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

console.log('--- auth ---');
let r = await post(PNG, 'x.png', 'image/png', '');
expect('anonymous upload blocked', r.status, 401);

console.log('\n--- file validation ---');
r = await post(Buffer.from('#!/bin/sh\necho hi'), 'evil.sh', 'application/x-sh');
expect('non-image rejected', r.status, 400, `"${r.body.message}"`);

r = await post(Buffer.alloc(6 * 1024 * 1024), 'huge.png', 'image/png');
expect('oversized file rejected', r.status, 400, `"${r.body.message}"`);

console.log('\n--- real upload to Cloudinary ---');
r = await post(PNG, 'product.png', 'image/png');
expect('image uploaded', r.status, 201);
const img = r.body.images?.[r.body.images.length - 1];
if (img) {
  console.log('      url      :', img.url);
  console.log('      publicId :', img.publicId);
  expect('  url is https', img.url.startsWith('https://'), true);
  expect('  publicId stored', Boolean(img.publicId), true);

  const head = await fetch(img.url, { method: 'HEAD' });
  expect('  image is publicly fetchable', head.status, 200, head.headers.get('content-type'));

  const saved = await Product.findById(product._id);
  expect('  persisted on product', saved.images.length > 0, true);

  console.log('\n--- delete ---');
  const del = await fetch(`${base}/api/products/${product._id}/images/${img.publicId}`, {
    method: 'DELETE', headers: { Cookie: cookie },
  });
  const delBody = await del.json().catch(() => ({}));
  expect('image deleted', del.status, 200, JSON.stringify(delBody).slice(0, 80));
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
server.close(); await mongoose.connection.close(); process.exit(fail ? 1 : 0);
