import User from '../src/models/User.js';
import Product from '../src/models/Product.js';
import Category from '../src/models/Category.js';
import Order from '../src/models/Order.js';
import Review from '../src/models/Review.js';
import Question from '../src/models/Question.js';
import Cart from '../src/models/Cart.js';
import Wishlist from '../src/models/Wishlist.js';
import Coupon from '../src/models/Coupon.js';
import { deleteImage, isCloudinaryConfigured } from '../src/config/cloudinary.js';
import { categories as demoCategories, products as demoProducts } from '../tests/fixtures/catalogData.js';

/**
 * Removes the demo data that earlier versions seeded automatically in
 * development - and ONLY that. Everything is matched on something the
 * seeders used and real data cannot plausibly share:
 *
 *  - products matching a demo catalogue row on name AND brand AND the exact
 *    description the seeder wrote ("<name> by <brand>. <specs>.") - so a real
 *    "iPhone 15" an admin added by hand is never mistaken for demo data
 *  - customers with an @example.com address (the demo shoppers)
 *  - orders placed BY those demo customers (a real customer's order is never
 *    deleted, even if it contains a demo product - it keeps its own snapshot)
 *  - reviews and questions by demo customers or on demo products
 *  - the WELCOME10 and FLAT500 sample coupons
 *  - demo categories, but only once no other product uses them
 *  - Cloudinary images attached to demo products
 *
 * Staff accounts, settings, the activity log and anything you created
 * yourself are left alone.
 *
 * @param {{ apply?: boolean, log?: Function }} options  apply=false is a dry run
 */
const purgeDemoData = async ({ apply = false, log = console.log } = {}) => {
  const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const categoryNames = demoCategories.map((c) => c.name);

  const products = await Product.find({
    $or: demoProducts.map(([name, brand]) => ({
      name,
      brand,
      description: new RegExp(`^${escape(`${name} by ${brand}. `)}`),
    })),
  }).select('_id name images');
  const productIds = products.map((p) => p._id);
  const users = await User.find({ role: 'customer', email: /@example\.com$/i }).select('_id');
  const userIds = users.map((u) => u._id);

  const orderFilter = { user: { $in: userIds } };
  const reviewFilter = { $or: [{ user: { $in: userIds } }, { product: { $in: productIds } }] };
  const questionFilter = { $or: [{ user: { $in: userIds } }, { product: { $in: productIds } }] };
  const couponFilter = { code: { $in: ['WELCOME10', 'FLAT500'] } };

  // A demo category survives if a real product still uses it.
  const demoCats = await Category.find({ name: { $in: categoryNames } }).select('_id name');
  const catsInUse = await Product.distinct('category', {
    category: { $in: demoCats.map((c) => c._id) },
    _id: { $nin: productIds },
  });
  const removableCats = demoCats.filter((c) => !catsInUse.some((id) => id.equals(c._id)));
  const keptCats = demoCats.filter((c) => catsInUse.some((id) => id.equals(c._id)));

  const images = products.flatMap((p) => p.images.map((i) => i.publicId)).filter((id) => id && !id.startsWith('generated:'));

  const counts = {
    products: products.length,
    customers: users.length,
    orders: await Order.countDocuments(orderFilter),
    reviews: await Review.countDocuments(reviewFilter),
    questions: await Question.countDocuments(questionFilter),
    coupons: await Coupon.countDocuments(couponFilter),
    categories: removableCats.length,
    cloudinaryImages: images.length,
  };

  log(apply ? 'Removing demo data:' : 'DRY RUN - this would remove:');
  for (const [k, v] of Object.entries(counts)) log(`  ${k.padEnd(17)} ${v}`);
  if (products.length) log(`  demo products: ${products.map((p) => p.name).join(', ')}`);
  if (keptCats.length) log(`  (keeping categories still used by your products: ${keptCats.map((c) => c.name).join(', ')})`);

  if (!apply) {
    log('\nNothing was changed. Re-run with --yes to delete.');
    return { applied: false, counts };
  }

  await Order.deleteMany(orderFilter);
  await Review.deleteMany(reviewFilter);
  await Question.deleteMany(questionFilter);
  await Coupon.deleteMany(couponFilter);
  // Real shoppers may have demo products sitting in a bag or wishlist.
  await Cart.updateMany({}, { $pull: { items: { product: { $in: productIds } } } });
  await Wishlist.updateMany({}, { $pull: { products: { $in: productIds } } });
  await Cart.deleteMany({ user: { $in: userIds } });
  await Wishlist.deleteMany({ user: { $in: userIds } });
  await Product.deleteMany({ _id: { $in: productIds } });
  await Category.deleteMany({ _id: { $in: removableCats.map((c) => c._id) } });
  await User.deleteMany({ _id: { $in: userIds } });

  if (images.length && isCloudinaryConfigured()) {
    const results = await Promise.allSettled(images.map((id) => deleteImage(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) log(`  ${failed} Cloudinary image(s) could not be deleted - remove them in the Cloudinary console.`);
  } else if (images.length) {
    log('  Cloudinary is not configured here, so demo images stay in your Cloudinary media library.');
  }

  log('Done.');
  return { applied: true, counts };
};

export default purgeDemoData;
