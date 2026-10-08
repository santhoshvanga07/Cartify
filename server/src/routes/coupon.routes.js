import { Router } from 'express';
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon, applyCoupon,
} from '../controllers/coupon.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Any signed-in shopper may preview a coupon against their own bag.
router.post('/apply', applyCoupon);

const adminOnly = authorize('admin', 'superadmin');
router.get('/', adminOnly, listCoupons);
router.post('/', adminOnly, createCoupon);
router.put('/:id', adminOnly, updateCoupon);
router.delete('/:id', adminOnly, deleteCoupon);

export default router;
