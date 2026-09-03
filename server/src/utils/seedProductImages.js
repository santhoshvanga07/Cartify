import Product from '../models/Product.js';
import buildProductImageDataUri from './generateProductImage.js';

const GENERATED_PREFIX = 'generated:';

/**
 * Gives every image-less product a generated placeholder image.
 *
 * Only touches products with NO images at all, so a real photo uploaded
 * through the admin panel is never overwritten. Generated images carry the
 * publicId prefix "generated:" so they can be found and replaced in bulk later.
 */
const seedProductImages = async () => {
  const products = await Product.find({
    $or: [{ images: { $size: 0 } }, { images: { $exists: false } }],
  });

  if (products.length === 0) return { skipped: true };

  for (const product of products) {
    product.images = [
      {
        url: buildProductImageDataUri({ name: product.name, brand: product.brand }),
        publicId: `${GENERATED_PREFIX}${product.slug}`,
      },
    ];
    await product.save();
  }

  console.log(`Product images generated: ${products.length}`);
  return { generated: products.length };
};

export default seedProductImages;
