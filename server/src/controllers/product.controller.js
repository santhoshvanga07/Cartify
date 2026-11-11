import Product from '../models/Product.js';
import { runProductQuery, escapeRegex } from '../services/productQuery.service.js';
import { logActivity } from '../services/activity.service.js';

/**
 * @route GET /api/products
 * @access Public
 * Query: q, category, minPrice, maxPrice, minRating, sort, page, limit
 *
 * Delegates to runProductQuery so the AI search endpoint executes the exact
 * same code path with the exact same filter object.
 */
export const listProducts = async (req, res) => {
  const result = await runProductQuery(req.query);
  res.status(200).json({ success: true, ...result });
};

/** @route GET /api/products/:slug  @access Public */
export const getProductBySlug = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true })
    .populate('category', 'name slug');

  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.status(200).json({ success: true, product });
};

/**
 * Fields an admin may set. ratingAvg and numReviews are computed from real
 * reviews, slug and searchText from the name - none of them may come from a
 * request body, or a rating could simply be typed in.
 */
const EDITABLE = [
  'name', 'brand', 'description', 'price', 'mrp', 'category', 'stock', 'attributes', 'isActive', 'optionName', 'variants',
];

/**
 * Sizes/colours from the admin form: [{ label, stock, stockWas? }].
 * Like the product stock, an option's stock is applied as a CHANGE from the
 * value the form started with (stockWas), so units sold while the form was
 * open are not undone. A new option takes its stock as given.
 */
const mergeVariants = (current = [], incoming) => {
  if (!Array.isArray(incoming)) return { error: 'Options must be a list' };
  const now = new Map(current.map((v) => [v.label, v.stock]));
  const out = [];
  for (const v of incoming) {
    const label = String(v?.label ?? '').trim();
    if (!label) continue;
    const stock = Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: `Stock for ${label} must be a whole number, 0 or more` };
    if (v.stockWas !== undefined && now.has(label)) {
      out.push({ label, stock: Math.max(0, now.get(label) + (stock - Number(v.stockWas))) });
    } else {
      out.push({ label, stock });
    }
  }
  return { variants: out };
};
const pick = (body = {}) => {
  const out = Object.fromEntries(EDITABLE.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  // Spec names become keys in a MongoDB map, which may not contain "." or start
  // with "$". "No. of cores" would otherwise fail the whole save.
  if (out.attributes && typeof out.attributes === 'object') {
    out.attributes = Object.fromEntries(
      Object.entries(out.attributes)
        .map(([k, v]) => [String(k).replace(/\./g, '').replace(/^\$+/, '').trim(), String(v ?? '').trim()])
        .filter(([k]) => k)
    );
  }
  return out;
};

/**
 * @route GET /api/products/admin/list?q=&status=active|removed|all&page=
 * @access Admin
 * The dashboard's own listing: paginated, and it includes removed products
 * so they can be restored. The public listing hides them.
 */
export const listProductsForAdmin = async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const limit = 25;
  const filter = {};
  if (req.query.status === 'removed') filter.isActive = false;
  else if (req.query.status !== 'all') filter.isActive = true;
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { brand: rx }];
  }
  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);
  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), products });
};

/** @route POST /api/products  @access Admin */
export const createProduct = async (req, res) => {
  const fields = pick(req.body);
  if (fields.variants !== undefined) {
    const merged = mergeVariants([], fields.variants);
    if (merged.error) return res.status(400).json({ success: false, message: merged.error });
    fields.variants = merged.variants;
  }
  const product = await Product.create(fields);
  logActivity(req, 'product.create', { type: 'product', id: product._id, label: product.name });
  res.status(201).json({ success: true, product });
};

/** @route PUT /api/products/:id  @access Admin */
export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const changes = pick(req.body);

  // Options are merged against what is in the database NOW (see mergeVariants).
  if (req.body?.variants !== undefined) {
    const merged = mergeVariants(product.variants, req.body.variants);
    if (merged.error) return res.status(400).json({ success: false, message: merged.error });
    changes.variants = merged.variants;
    delete changes.stock; // with options, the total is their sum
  }

  /**
   * Stock moves while the edit form is open (sales, cancellations). The form
   * sends the stock it STARTED from as `stockWas`; we apply the admin's change
   * as a difference ("+5"), so fixing a typo in the description can no longer
   * write back an old stock count and un-sell or re-sell units.
   */
  let stockDelta = null;
  const willHaveVariants = (changes.variants ?? product.variants).length > 0;
  if (willHaveVariants) delete changes.stock;
  if (changes.stock !== undefined && req.body.stockWas !== undefined) {
    stockDelta = Number(changes.stock) - Number(req.body.stockWas);
    if (!Number.isInteger(stockDelta)) {
      return res.status(400).json({ success: false, message: 'Stock must be a whole number' });
    }
    delete changes.stock;
  }

  Object.assign(product, changes);
  await product.save(); // save(), not findByIdAndUpdate - so hooks and validators run

  if (stockDelta) {
    const updated = await Product.findOneAndUpdate(
      { _id: product._id, stock: { $gte: -stockDelta } },
      { $inc: { stock: stockDelta } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      const now = (await Product.findById(product._id)).stock;
      return res.status(409).json({
        success: false,
        message: `Stock changed while you were editing - only ${now} left now. Other changes were saved; please re-check stock.`,
      });
    }
    product.stock = updated.stock;
  }

  logActivity(req, 'product.update', { type: 'product', id: product._id, label: product.name }, Object.keys(pick(req.body)).join(', '));
  res.status(200).json({ success: true, product });
};

/**
 * @route DELETE /api/products/:id  @access Admin
 * SOFT delete: orders reference products forever. Hard-deleting one would
 * break every past invoice that points at it.
 */
export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  product.isActive = false;
  await product.save();
  logActivity(req, 'product.delete', { type: 'product', id: product._id, label: product.name });
  res.status(200).json({ success: true, message: 'Product removed' });
};
