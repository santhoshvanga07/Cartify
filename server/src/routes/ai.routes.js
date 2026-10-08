import { Router } from 'express';
import {
  aiSearch, aiCompare, recommendations, aiStatus, boughtTogether, trending, forYou, bySlugs,
} from '../controllers/ai.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { aiLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/status', aiStatus);
router.get('/recommendations/:slug', recommendations); // no LLM, no limiter needed
router.get('/recommendations/:slug/bought-together', boughtTogether);
router.get('/trending', trending);
router.get('/for-you', protect, forYou);
router.get('/by-slugs', bySlugs);
router.post('/search', aiLimiter, aiSearch);
router.post('/compare', aiLimiter, aiCompare);

export default router;
