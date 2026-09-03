import { Router } from 'express';
import {
  overview, salesOverTime, topProducts, categorySales, customerGrowth, orderStatusBreakdown,
} from '../controllers/analytics.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// Business figures are staff-only. A customer must never see total revenue.
router.use(protect, authorize('admin', 'superadmin'));

router.get('/overview', overview);
router.get('/sales', salesOverTime);
router.get('/top-products', topProducts);
router.get('/category-sales', categorySales);
router.get('/customer-growth', customerGrowth);
router.get('/order-status', orderStatusBreakdown);

export default router;
