import 'dotenv/config';
import crypto from 'node:crypto';

/**
 * Diagnoses the Cloudinary configuration and says exactly what to fix.
 * Run with: npm run check:cloudinary
 *
 * Note: this sets process.exitCode rather than calling process.exit().
 * Calling exit() while fetch still holds open sockets trips a libuv
 * assertion on Windows; setting exitCode lets Node close down cleanly
 * and still return the right status to the shell.
 */

const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const key = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;

const line = (label, value) => console.log(`  ${label.padEnd(18)} ${value}`);

const sign = (params) =>
  crypto
    .createHash('sha1')
    .update(
      Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + secret
    )
    .digest('hex');

const explain = (status, message) => {
  console.log('  WHAT IT MEANS');
  if (/Invalid Signature/i.test(message)) {
    console.log('    The api key and api secret do not belong together.');
    console.log('    Every key has its OWN secret - you cannot mix one key');
    console.log("    with another key's secret.");
    console.log('\n  HOW TO FIX');
    console.log('    Cloudinary > Settings > API Keys.');
    console.log(`    Find the row for key ${key} and copy THAT row's secret`);
    console.log('    into CLOUDINARY_API_SECRET in server/.env.');
  } else if (/missing permissions/i.test(message)) {
    console.log('    The credentials are valid, but this key is a RESTRICTED');
    console.log('    key and is not allowed to upload.');
    console.log('\n  HOW TO FIX');
    console.log('    Cloudinary > Settings > API Keys.');
    console.log('    Use the MASTER key - a different row with a different');
    console.log('    key number - and copy both its key and its secret.');
  } else if (status === 401) {
    console.log('    Cloudinary did not accept these credentials at all.');
    console.log('\n  HOW TO FIX');
    console.log('    Re-copy the cloud name, api key and api secret, checking');
    console.log('    for stray spaces or a truncated paste.');
  } else {
    console.log('    An unexpected response from Cloudinary.');
    console.log('\n  HOW TO FIX');
    console.log('    Check status.cloudinary.com, then try again.');
  }
};

const run = async () => {
  console.log('\nCLOUDINARY CHECK\n');
  line('cloud name', cloud || 'MISSING');
  line('api key', key || 'MISSING');
  line('api secret', secret ? `${secret.length} chars (hidden)` : 'MISSING');

  if (!cloud || !key || !secret) {
    console.log('\n  Fill in all three in server/.env, then run this again.\n');
    return 1;
  }

  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  console.log('\n  uploading a 1x1 test image...\n');

  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('file', new Blob([PIXEL], { type: 'image/png' }), 'check.png');
  form.append('api_key', key);
  form.append('timestamp', String(timestamp));
  form.append('folder', 'cartify/_check');
  form.append('signature', sign({ folder: 'cartify/_check', timestamp }));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.error?.message || `HTTP ${response.status}`;
    console.log(`  RESULT: FAILED (${response.status})\n`);
    line('cloudinary says', message);
    console.log('');
    explain(response.status, message);
    console.log('');
    return 1;
  }

  console.log('  RESULT: WORKING\n');
  line('uploaded to', body.secure_url);

  // Clean up - this was only a test.
  const delTs = Math.floor(Date.now() / 1000);
  const del = new FormData();
  del.append('public_id', body.public_id);
  del.append('api_key', key);
  del.append('timestamp', String(delTs));
  del.append('signature', sign({ public_id: body.public_id, timestamp: delTs }));

  const cleanup = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
    method: 'POST',
    body: del,
  });
  line('cleanup', cleanup.ok ? 'test image deleted' : 'could not delete test image');

  console.log('\n  Uploads work. Next steps:');
  console.log('    npm run test:upload     verify the full upload endpoint');
  console.log('    then add photos from the admin panel: /admin/products > Edit\n');
  return 0;
};

process.exitCode = await run();
