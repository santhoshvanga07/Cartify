import Product from '../models/Product.js';
import { runProductQuery } from '../services/productQuery.service.js';
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

/** @route POST /api/products  @access Admin */
export const createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  logActivity(req, 'product.create', { type: 'product', id: product._id, label: product.name });
  res.status(201).json({ success: true, product });
};

/** @route PUT /api/products/:id  @access Admin */
export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  Object.assign(product, req.body);
  await product.save(); // save(), not findByIdAndUpdate - so hooks and validators run
  logActivity(req, 'product.update', { type: 'product', id: product._id, label: product.name }, Object.keys(req.body).join(', '));
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
