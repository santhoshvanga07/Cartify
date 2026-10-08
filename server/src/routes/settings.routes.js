import { Router } from 'express';
import {
  getPublicSettings, getAllSettings, updateSettings, listActivity,
} from '../controllers/settings.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/public', getPublicSettings);

const superOnly = [protect, authorize('superadmin')];
router.get('/', superOnly, getAllSettings);
router.put('/', superOnly, updateSettings);
router.get('/activity', superOnly, listActivity);

export default router;
