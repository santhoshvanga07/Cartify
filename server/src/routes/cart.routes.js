import { Router } from 'express';
import {
  getCart, addToCart, updateCartItem, removeCartItem, clearCart,
} from '../controllers/cart.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Every cart route needs a logged-in user - a cart belongs to somebody.
router.use(protect);

router.get('/', getCart);
router.post('/', addToCart);
router.delete('/', clearCart);
router.patch('/:productId', updateCartItem);
router.delete('/:productId', removeCartItem);

export default router;
