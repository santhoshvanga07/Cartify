import Category from '../models/Category.js';
import Product from '../models/Product.js';

/** @route GET /api/categories  @access Public */
export const listCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.status(200).json({ success: true, count: categories.length, categories });
};

/** @route POST /api/categories  @access Admin */
export const createCategory = async (req, res) => {
  const { name, description } = req.body;
  const category = await Category.create({ name, description });
  res.status(201).json({ success: true, category });
};

/** @route PUT /api/categories/:id  @access Admin */
export const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  // Assign then save() so the slug pre-save hook runs.
  Object.assign(category, req.body);
  await category.save();

  res.status(200).json({ success: true, category });
};

/** @route DELETE /api/categories/:id  @access Admin */
export const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  // Refuse to orphan products - referential integrity is our job, not MongoDB's.
  const inUse = await Product.countDocuments({ category: category._id, isActive: true });
  if (inUse > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete: ${inUse} active product(s) use this category`,
    });
  }

  category.isActive = false; // soft delete
  await category.save();
  res.status(200).json({ success: true, message: 'Category deleted' });
};
