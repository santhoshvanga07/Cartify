import { Router } from 'express';
import {
  listProducts, getProductBySlug, createProduct, updateProduct, deleteProduct,
} from '../controllers/product.controller.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.middleware.js';
import { uploadSingleImage } from '../middleware/upload.middleware.js';
import { uploadProductImage, deleteProductImage } from '../controllers/upload.controller.js';
import { listReviews, createReview } from '../controllers/review.controller.js';

const router = Router();
const adminOnly = [protect, authorize('admin', 'superadmin')];

router.get('/', listProducts);                   // public
router.get('/:slug', getProductBySlug);          // public

// Reviews hang off a product. optionalAuth so guests can read them while
// signed-in visitors also learn which review is theirs.
router.get('/:slug/reviews', optionalAuth, listReviews);
router.post('/:slug/reviews', protect, createReview);
router.post('/', adminOnly, createProduct);
router.put('/:id', adminOnly, updateProduct);
router.delete('/:id', adminOnly, deleteProduct);

// Images. The upload middleware runs AFTER auth - no point parsing a 5 MB
// file from someone who is not allowed to upload one.
router.post('/:id/images', adminOnly, uploadSingleImage('image'), uploadProductImage);
// publicId contains slashes, so match the rest of the path with a wildcard.
router.delete('/:id/images/*publicId', adminOnly, deleteProductImage);

export default router;
