import { Router } from 'express';

import {
  register, login, logout, getMe, updateMe, changePassword, forgotPassword, resetPassword,
  verifyEmail, resendVerification,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  listAddresses, addAddress, updateAddress, setDefaultAddress, deleteAddress,
} from '../controllers/address.controller.js';
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

// Confirming the email address. "resend" is declared first so it is not read as a token.
router.post('/verify-email/resend', protect, passwordResetLimiter, resendVerification);
router.post('/verify-email/:token', passwordResetLimiter, verifyEmail);

// Saved delivery addresses (the signed-in customer's own).
router.get('/addresses', protect, listAddresses);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:id', protect, updateAddress);
router.patch('/addresses/:id/default', protect, setDefaultAddress);
router.delete('/addresses/:id', protect, deleteAddress);

export default router;
