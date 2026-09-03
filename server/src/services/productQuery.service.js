import Product from '../models/Product.js';
import Category from '../models/Category.js';

export const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { ratingAvg: -1 },
};

export const VALID_SORTS = Object.keys(SORT_OPTIONS);

/** Escapes regex metacharacters so user text is matched literally. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Turns a plain filter object into a MongoDB query.
 *
 * ONE implementation, TWO callers:
 *   - GET /api/products      (the filter sidebar sends this object)
 *   - POST /api/ai/search    (the LLM produces the same object)
 *
 * That is the whole AI architecture: the model only fills in this object.
 * It never chooses products, so it can never invent one.
 */
export const buildProductFilter = async ({
  q,
  category,
  minPrice,
  maxPrice,
  minRating,
  inStockOnly,
} = {}) => {
  const filter = { isActive: true };

  if (q) {
    /**
     * Split into words and require EVERY word to appear in searchText,
     * the field the Product model builds from name + brand + meaningful
     * attributes. That is how "waterproof trekking" finds shoes not named
     * that, WITHOUT also matching the ones marked "Waterproof: No".
     *
     * escapeRegex is not optional: user text goes straight into a regex,
     * so an input of "(((" would otherwise throw, and ".*.*.*" would hand
     * an attacker a cheap way to pin the CPU.
     */
    const words = q
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .slice(0, 6);

    if (words.length) {
      filter.$and = words.map((word) => {
        const rx = { $regex: escapeRegex(word), $options: 'i' };
        return { searchText: rx };
      });
    }
  }

  if (category) {
    const cat = await Category.findOne({ slug: category });
    // An unknown category must return nothing, not everything.
    filter.category = cat ? cat._id : null;
  }

  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = Number(minPrice);
    if (maxPrice != null) filter.price.$lte = Number(maxPrice);
  }

  if (minRating != null) filter.ratingAvg = { $gte: Number(minRating) };
  if (inStockOnly) filter.stock = { $gt: 0 };

  return filter;
};

/** Runs a filter and returns a paginated result in the standard envelope. */
export const runProductQuery = async (params = {}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
  const sort = VALID_SORTS.includes(params.sort) ? params.sort : 'newest';

  const execute = async (p) => {
    const filter = await buildProductFilter(p);
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('category', 'name slug')
        .sort(SORT_OPTIONS[sort])
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    return { count: products.length, total, page, pages: Math.ceil(total / limit), products };
  };

  const result = await execute(params);

  /**
   * GRACEFUL WIDENING.
   * Keyword and category together can be over-specific: asking for
   * "headphones" in the Audio category matches nothing, because the products
   * are described as "Over-ear", not "headphones". Rather than show an empty
   * shelf, drop the keyword and keep the filters that clearly came from
   * intent (category, price), then tell the caller we did.
   *
   * Real search engines do this - "no results for X, showing results for Y".
   */
  const hasOtherFilters = params.category || params.minPrice != null || params.maxPrice != null;
  if (result.total === 0 && params.q && hasOtherFilters) {
    const widened = await execute({ ...params, q: undefined });
    if (widened.total > 0) return { ...widened, widened: true, droppedKeyword: params.q };
  }

  return result;
};
