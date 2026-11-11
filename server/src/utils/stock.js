import Product from '../models/Product.js';

/**
 * Taking stock and putting it back - the only two ways checkout, cancellation
 * and returns change stock. Each is ONE conditional database update, so two
 * shoppers racing for the last unit (of a product, or of one size) cannot both
 * get it. With an option (size/colour), its stock and the product's total
 * move together.
 */

/** At or below this many units a product (or one size of it) counts as low on stock. */
export const LOW_STOCK = 5;

/**
 * @returns {Promise<object|null>} the product as it is AFTER taking the units,
 *          or null when there was not enough stock
 */
export const takeStock = (productId, variant, qty) =>
  variant
    ? Product.findOneAndUpdate(
      { _id: productId, isActive: true, variants: { $elemMatch: { label: variant, stock: { $gte: qty } } } },
      { $inc: { stock: -qty, 'variants.$.stock': -qty } },
      { returnDocument: 'after' }
    )
    : Product.findOneAndUpdate(
      { _id: productId, isActive: true, stock: { $gte: qty }, 'variants.0': { $exists: false } },
      { $inc: { stock: -qty } },
      { returnDocument: 'after' }
    );

export const putBackStock = async (productId, variant, qty) => {
  if (variant) {
    const result = await Product.updateOne(
      { _id: productId, 'variants.label': variant },
      { $inc: { stock: qty, 'variants.$.stock': qty } }
    );
    if (result.modifiedCount === 1) return;
  }
  // A product without options. (If the size/colour was deleted since the order,
  // there is nothing to put the units back into; the total stays equal to the
  // options that remain.)
  await Product.updateOne({ _id: productId, 'variants.0': { $exists: false } }, { $inc: { stock: qty } });
};
