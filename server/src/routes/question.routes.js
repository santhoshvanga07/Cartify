import { Router } from 'express';
import {
  answerQuestion, upvoteQuestion, markAnswerHelpful, reportQuestion,
  deleteQuestion, deleteAnswer, listReportedQuestions, setVisibility,
} from '../controllers/question.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

const staff = authorize('admin', 'superadmin');

// Declared before '/:id' so "reported" is not read as an id.
router.get('/reported', staff, listReportedQuestions);
router.patch('/:id/visibility', staff, setVisibility);

router.delete('/:id', deleteQuestion);
router.post('/:id/upvote', upvoteQuestion);
router.post('/:id/report', reportQuestion);
router.post('/:id/answers', answerQuestion);
router.post('/:id/answers/:answerId/helpful', markAnswerHelpful);
router.delete('/:id/answers/:answerId', deleteAnswer);

export default router;
