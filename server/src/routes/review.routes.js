import { Router } from 'express';
import {
  updateReview, deleteReview, toggleHelpful, reportReview,
  listReportedReviews, setApproval,
} from '../controllers/review.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// The moderation queue is declared BEFORE '/:id' or Express would read
// "reported" as an id.
router.get('/reported', protect, authorize('admin', 'superadmin'), listReportedReviews);
router.patch('/:id/approve', protect, authorize('admin', 'superadmin'), setApproval);

router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.post('/:id/helpful', protect, toggleHelpful);
router.post('/:id/report', protect, reportReview);

export default router;
