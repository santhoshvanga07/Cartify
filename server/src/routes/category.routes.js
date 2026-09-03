import { Router } from 'express';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../controllers/category.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();
const adminOnly = [protect, authorize('admin', 'superadmin')];

router.get('/', listCategories);                 // public
router.post('/', adminOnly, createCategory);
router.put('/:id', adminOnly, updateCategory);
router.delete('/:id', adminOnly, deleteCategory);

export default router;
