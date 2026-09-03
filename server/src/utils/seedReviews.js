import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const COMMENTS = {
  5: [
    'Exactly what I wanted. Arrived a day early and the build quality is excellent.',
    'Genuinely impressed. Worth every rupee and I would buy it again.',
    'Been using it daily for two weeks now with zero complaints.',
  ],
  4: [
    'Very good overall. Loses a star only because the packaging was damaged.',
    'Does the job well. Slightly heavier than I expected but no real issue.',
    'Happy with it. Setup took a few minutes and it has been smooth since.',
  ],
  3: [
    'Does what it says, nothing more. Fine for the price.',
    'Average. Works, but I have seen better at this price point.',
    'Mixed feelings. Good features, but the finish feels cheap.',
  ],
  2: [
    'Disappointed. Stopped working properly after the first week.',
    'Not as described. The quality is well below what the photos suggest.',
  ],
};

const TITLES = {
  5: ['Excellent', 'Highly recommend', 'Perfect'],
  4: ['Very good', 'Happy with it', 'Solid choice'],
  3: ['Decent', 'It is okay', 'Average'],
  2: ['Not for me', 'Expected better'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Creates real Review documents for products that customers actually received,
 * then recalculates every product's rating from them.
 *
 * This matters beyond looking nice: seedCatalog sets ratingAvg and numReviews
 * to made-up numbers, so a product could claim "620 reviews" while its review
 * list was empty. Denormalised fields must be DERIVED from the source data,
 * never invented alongside it - otherwise they drift and nobody trusts either.
 *
 * DEVELOPMENT ONLY.
 */
const seedReviews = async () => {
  if ((await Review.countDocuments()) > 0) return { skipped: true };

  const delivered = await Order.find({ status: 'delivered' }).select('user items');
  if (delivered.length === 0) return { skipped: true, reason: 'no delivered orders' };

  // One review per (user, product) pair - the unique index enforces it anyway.
  const seen = new Set();
  let created = 0;

  for (const order of delivered) {
    for (const item of order.items) {
      const key = `${order.user}-${item.product}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Not everyone reviews what they buy - about 60% do.
      if (Math.random() > 0.6) continue;

      // Weighted towards positive, like a real catalogue.
      const rating = pick([5, 5, 5, 4, 4, 4, 3, 3, 2]);

      try {
        await Review.create({
          product: item.product,
          user: order.user,
          rating,
          title: pick(TITLES[rating]),
          comment: pick(COMMENTS[rating]),
          isVerifiedPurchase: true, // they are all from delivered orders
        });
        created++;
      } catch {
        // Duplicate (product, user) - skip it.
      }
    }
  }

  // Recalculate EVERY product, so ones with no reviews drop to 0 instead of
  // keeping the invented numbers from seedCatalog.
  const products = await Product.find().select('_id');
  for (const p of products) await Review.recalculateProductRating(p._id);

  console.log(`Reviews seeded: ${created} reviews, ${products.length} product ratings recalculated`);
  return { created };
};

export default seedReviews;
