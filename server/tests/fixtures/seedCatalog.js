import Category from '../../src/models/Category.js';
import Product from '../../src/models/Product.js';
import { categories, products } from './catalogData.js';

/** Populates categories and products if the catalogue is empty. Idempotent. */
const seedCatalog = async () => {
  if ((await Product.countDocuments()) > 0) return { skipped: true };

  const catIds = {};
  for (const c of categories) {
    // new + save() rather than create() so the slug pre-save hook runs.
    let doc = await Category.findOne({ name: c.name });
    if (!doc) doc = await new Category(c).save();
    catIds[c.name] = doc._id;
  }

  for (const row of products) {
    const [name, brand, price, mrp, cat, stock, ratingAvg, numReviews, attributes] = row;
    const specs = Object.entries(attributes)
      .map(([k, v]) => k + ': ' + v)
      .join(', ');

    await new Product({
      name,
      brand,
      description: name + ' by ' + brand + '. ' + specs + '.',
      price,
      mrp,
      category: catIds[cat],
      stock,
      ratingAvg,
      numReviews,
      attributes,
      images: [],
    }).save();
  }

  console.log(
    'Catalogue seeded: ' + categories.length + ' categories, ' + products.length + ' products'
  );
  return { categories: categories.length, products: products.length };
};

export default seedCatalog;
