import { Router } from 'express';
import { salesReport, ordersReport, productsReport } from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// Business figures: staff only, like analytics.
router.use(protect, authorize('admin', 'superadmin'));

router.get('/sales', salesReport);
router.get('/orders', ordersReport);
router.get('/products', productsReport);

export default router;
