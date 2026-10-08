import { Router } from 'express';

import {
  register, login, logout, getMe, updateMe, changePassword, forgotPassword, resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  registerRules, loginRules, profileRules, changePasswordRules, forgotPasswordRules, resetPasswordRules,
  runValidation,
} from '../validators/auth.validator.js';
import { loginLimiter, registerLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', registerLimiter, registerRules, runValidation, register);
router.post('/login', loginLimiter, loginRules, runValidation, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/me', protect, profileRules, runValidation, updateMe);
router.put('/password', protect, loginLimiter, changePasswordRules, runValidation, changePassword);

router.post('/forgot-password', passwordResetLimiter, forgotPasswordRules, runValidation, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPasswordRules, runValidation, resetPassword);

export default router;
