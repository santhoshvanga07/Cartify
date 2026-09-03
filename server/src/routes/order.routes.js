import { Router } from 'express';
import {
  createOrder, getMyOrders, getOrder, cancelOrder, listAllOrders, updateOrderStatus,
} from '../controllers/order.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

// Customer
router.post('/', createOrder);
router.get('/my', getMyOrders);
router.patch('/:id/cancel', cancelOrder);

// Admin - registered before '/:id' would be ambiguous, so order matters:
// '/my' is declared above '/:id' or Express would treat "my" as an id.
router.get('/', authorize('admin', 'superadmin'), listAllOrders);
router.patch('/:id/status', authorize('admin', 'superadmin'), updateOrderStatus);

// Owner or staff - the controller decides which.
router.get('/:id', getOrder);

export default router;
