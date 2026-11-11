import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { logActivity } from '../services/activity.service.js';

/** @route GET /api/categories  @access Public */
export const listCategories = async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.status(200).json({ success: true, count: categories.length, categories });
};

/** @route POST /api/categories  @access Admin */
export const createCategory = async (req, res) => {
  const { name, description } = req.body ?? {};

  // A category deleted earlier still holds its name; bring it back instead of
  // failing with "name already exists" for a category nobody can see.
  const deleted = await Category.findOne({ name: String(name ?? '').trim(), isActive: false });
  if (deleted) {
    deleted.isActive = true;
    if (description !== undefined) deleted.description = description;
    await deleted.save();
    logActivity(req, 'category.create', { type: 'category', id: deleted._id, label: deleted.name }, 'restored');
    return res.status(201).json({ success: true, category: deleted });
  }

  const category = await Category.create({ name, description });
  logActivity(req, 'category.create', { type: 'category', id: category._id, label: category.name });
  res.status(201).json({ success: true, category });
};

/** @route PUT /api/categories/:id  @access Admin */
export const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  // Only these two: isActive must go through delete (which checks the category
  // is unused), and the slug follows the name. Assign then save() so the slug
  // pre-save hook runs.
  const { name, description } = req.body ?? {};
  if (name !== undefined) category.name = name;
  if (description !== undefined) category.description = description;
  await category.save();
  logActivity(req, 'category.update', { type: 'category', id: category._id, label: category.name });

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
  logActivity(req, 'category.delete', { type: 'category', id: category._id, label: category.name });
  res.status(200).json({ success: true, message: 'Category deleted' });
};
