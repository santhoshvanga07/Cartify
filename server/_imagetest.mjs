/**
 * Product photos end to end, with Cloudinary's uploader stubbed in-process:
 * multer parsing, auth, limits, our controller and the database all run for
 * real; only the network call to Cloudinary is replaced.
 * (_uploadtest.mjs does the same against the REAL Cloudinary when keys are set.)
 */
process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
process.env.CLOUDINARY_API_KEY = 'key';
process.env.CLOUDINARY_API_SECRET = 'secret';

const { v2: cloudinary } = await import('cloudinary');
const uploads = [];
const destroyed = [];
cloudinary.uploader.upload_stream = (options, cb) => ({
  end: (buffer) => {
    uploads.push({ options, bytes: buffer.length });
    const id = `${options.folder}/img${uploads.length}`;
    cb(null, { secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/${id}.jpg`, public_id: id });
  },
});
cloudinary.uploader.destroy = async (id) => {
  destroyed.push(id);
  return { result: 'ok' };
};

const { startHarness } = await import('./_harness.mjs');
const { call, expect, loginSuperAdmin, register, finish } = await startHarness();
await loginSuperAdmin();
await register('shopper');

// A 1x1 PNG.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const form = (bytes = png, type = 'image/png', name = 'photo.png') => {
  const f = new FormData();
  f.append('image', new Blob([bytes], { type }), name);
  return f;
};

console.log('--- integrations status ---');
let r = await call('shopper', 'GET', '/api/health/integrations');
expect('customers cannot see integration status', r.status, 403);
r = await call('sa', 'GET', '/api/health/integrations');
expect('staff see cloudinary as configured', r.body.integrations?.cloudinary, true);
expect('no secrets in the status payload', JSON.stringify(r.body).includes('secret'), false);

console.log('\n--- create a product, then add photos ---');
r = await call('sa', 'POST', '/api/categories', { name: 'Ceramics' });
const cat = r.body.category;
r = await call('sa', 'POST', '/api/products', {
  name: 'Stoneware Mug', brand: 'Kiln & Co', description: 'Hand-thrown, 350 ml.',
  price: 650, mrp: 800, category: cat._id, stock: 12,
  attributes: { Capacity: '350 ml', 'Dishwasher safe': 'Yes' },
  ratingAvg: 5, numReviews: 999,
});
expect('product created', r.status, 201);
expect('ratingAvg cannot be typed in', r.body.product?.ratingAvg, 0);
expect('numReviews cannot be typed in', r.body.product?.numReviews, 0);
expect('specs saved', r.body.product?.attributes?.Capacity, '350 ml');
const id = r.body.product._id;

r = await call('shopper', 'POST', `/api/products/${id}/images`, form());
expect('customers cannot upload', r.status, 403);

r = await call('sa', 'POST', `/api/products/${id}/images`, form());
expect('admin uploads a photo', r.status, 201);
expect('stored the Cloudinary https url', r.body.images?.[0]?.url.startsWith('https://res.cloudinary.com/'), true);
expect('uploaded into cartify/products', uploads[0]?.options.folder, 'cartify/products');
expect('Cloudinary asked to cap size and auto-format', JSON.stringify(uploads[0]?.options.transformation).includes('auto'), true);

r = await call('sa', 'POST', `/api/products/${id}/images`, form(Buffer.from('not an image'), 'text/plain', 'x.txt'));
expect('non-image rejected', r.status, 400, `"${r.body.message}"`);
r = await call('sa', 'POST', `/api/products/${id}/images`, form(Buffer.alloc(6 * 1024 * 1024), 'image/jpeg', 'big.jpg'));
expect('over 5 MB rejected', r.status, 400, `"${r.body.message}"`);

for (let i = 0; i < 4; i++) await call('sa', 'POST', `/api/products/${id}/images`, form());
r = await call('sa', 'POST', `/api/products/${id}/images`, form());
expect('sixth photo refused', r.status, 409);

r = await call(null, 'GET', '/api/products/stoneware-mug');
expect('shoppers see 5 photos', r.body.product?.images?.length, 5);

const first = r.body.product.images[0].publicId;
r = await call('sa', 'DELETE', `/api/products/${id}/images/${first}`);
expect('admin removes a photo', r.body.images?.length, 4);
expect('removed from Cloudinary too', destroyed[0], first);

await finish();// Test accounts are made up: skip the sign-up email code (tested in _accounttest).
process.env.REQUIRE_EMAIL_VERIFICATION ??= 'false';

