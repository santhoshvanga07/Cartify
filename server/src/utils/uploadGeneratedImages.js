import Product from '../models/Product.js';
import { buildProductSvg } from './generateProductImage.js';
import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Moves generated placeholder artwork off the database and onto Cloudinary.
 *
 * The seeded placeholders are stored as data URIs - roughly 1 KB of base64
 * sitting inside every product document, re-sent on every product query.
 * Once Cloudinary works, uploading them turns each into a short CDN URL:
 * smaller documents, cached delivery, and automatic format conversion.
 *
 * Products with a REAL uploaded photo are left alone - only entries tagged
 * "generated:" are touched.
 */
const uploadGeneratedImages = async () => {
  if (!isCloudinaryConfigured()) return { skipped: true, reason: 'cloudinary not configured' };

  const products = await Product.find({ 'images.publicId': /^generated:/ });
  if (products.length === 0) return { skipped: true, reason: 'nothing to migrate' };

  let migrated = 0;
  const failures = [];

  const migrateOne = async (product) => {
    const svg = buildProductSvg({ name: product.name, brand: product.brand });
    try {
      // Cloudinary rasterises the SVG at upload time, so what we store and
      // serve is a real raster image - no SVG rendering quirks in the browser.
      // We do NOT pin a format: the config already sets fetch_format auto, so
      // Cloudinary picks the smallest format each browser supports.
      const result = await uploadBuffer(Buffer.from(svg, 'utf8'), 'cartify/products', {
        public_id: `product-${product.slug}`,
        overwrite: true,
      });

      product.images = [{ url: result.secure_url, publicId: result.public_id }];
      await product.save();
      migrated++;
    } catch (err) {
      failures.push(`${product.slug}: ${err.message}`);
    }
  };

  /**
   * Upload in small concurrent batches.
   *
   * Each round trip to Cloudinary takes ~3 seconds, so doing 24 one after
   * another wastes over a minute waiting on the network. Six at a time cuts
   * that to about fifteen seconds. We cap the batch rather than firing all 24
   * at once so we do not trip Cloudinary's own rate limits.
   */
  const BATCH = 6;
  for (let i = 0; i < products.length; i += BATCH) {
    await Promise.all(products.slice(i, i + BATCH).map(migrateOne));
    process.stdout.write(`  uploaded ${Math.min(i + BATCH, products.length)}/${products.length}\r`);
  }
  process.stdout.write('\n');

  console.log(`Images migrated to Cloudinary: ${migrated}/${products.length}`);
  if (failures.length) console.warn('  failures:', failures.slice(0, 3).join(' | '));

  return { migrated, failed: failures.length };
};

export default uploadGeneratedImages;
