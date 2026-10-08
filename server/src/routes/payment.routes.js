import { Router } from 'express';
import { paymentConfig, retryPayment, verifyPayment } from '../controllers/payment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/config', paymentConfig);
router.post('/:orderId/retry', protect, retryPayment);
router.post('/:orderId/verify', protect, verifyPayment);

export default router;
