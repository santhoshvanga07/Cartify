import { Router } from 'express';

import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { registerRules, loginRules, runValidation } from '../validators/auth.validator.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', registerLimiter, registerRules, runValidation, register);
router.post('/login', loginLimiter, loginRules, runValidation, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
