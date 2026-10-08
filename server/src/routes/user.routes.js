import { Router } from 'express';

import {
  listUsers,
  createAdmin,
  updateUserRole,
  updateUserStatus,
  listCustomers,
} from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { registerRules, runValidation } from '../validators/auth.validator.js';

const router = Router();

// Everything below requires a logged-in user.
router.use(protect);

// Admins and Super Admins may read the user list.
router.get('/', authorize('admin', 'superadmin'), listUsers);
router.get('/customers', authorize('admin', 'superadmin'), listCustomers);

// Only Super Admins may create or modify accounts.
router.post('/admins', authorize('superadmin'), registerRules, runValidation, createAdmin);
router.patch('/:id/role', authorize('superadmin'), updateUserRole);
// Admins may suspend customers; the controller keeps staff accounts Super-Admin-only.
router.patch('/:id/status', authorize('admin', 'superadmin'), updateUserStatus);

export default router;
