import Category, { OTHERS_NAME, OTHERS_SLUG } from '../models/Category.js';

/**
 * Makes sure the built-in "Others" category exists (and is active), so a
 * product that fits no category can still be listed - even in a brand-new
 * store before any category has been created. Idempotent; safe on every start.
 */
const ensureOthersCategory = async () => {
  const existing = await Category.findOne({ slug: OTHERS_SLUG });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
    }
    return existing;
  }
  return Category.create({ name: OTHERS_NAME, description: 'Products that do not fit another category' });
};

export default ensureOthersCategory;
