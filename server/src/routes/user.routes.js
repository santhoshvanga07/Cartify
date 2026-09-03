import { Router } from 'express';

import {
  listUsers,
  createAdmin,
  updateUserRole,
  updateUserStatus,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { registerRules, runValidation } from '../validators/auth.validator.js';

const router = Router();

// Everything below requires a logged-in user.
router.use(protect);

// Admins and Super Admins may read the user list.
router.get('/', authorize('admin', 'superadmin'), listUsers);

// Only Super Admins may create or modify accounts.
router.post('/admins', authorize('superadmin'), registerRules, runValidation, createAdmin);
router.patch('/:id/role', authorize('superadmin'), updateUserRole);
router.patch('/:id/status', authorize('superadmin'), updateUserStatus);

export default router;
