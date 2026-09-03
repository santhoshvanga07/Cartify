import { Router } from 'express';
import { aiSearch, aiCompare, recommendations, aiStatus } from '../controllers/ai.controller.js';
import { aiLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/status', aiStatus);
router.get('/recommendations/:slug', recommendations); // no LLM, no limiter needed
router.post('/search', aiLimiter, aiSearch);
router.post('/compare', aiLimiter, aiCompare);

export default router;
