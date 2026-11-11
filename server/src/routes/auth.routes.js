import { Router } from 'express';

import {
  register, login, logout, getMe, updateMe, changePassword, forgotPassword, resetPassword,
  verifySignup, resendSignupCode,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import {
  listAddresses, addAddress, updateAddress, setDefaultAddress, deleteAddress,
} from '../controllers/address.controller.js';
import {
  registerRules, loginRules, profileRules, changePasswordRules, forgotPasswordRules, resetPasswordRules, signupCodeRules,
  runValidation,
} from '../validators/auth.validator.js';
import { loginLimiter, registerLimiter, passwordResetLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', registerLimiter, registerRules, runValidation, register);
// Sign-up step 2: the 6-digit code from the email creates the account.
router.post('/register/verify', loginLimiter, signupCodeRules, runValidation, verifySignup);
router.post('/register/resend', passwordResetLimiter, forgotPasswordRules, runValidation, resendSignupCode);
router.post('/login', loginLimiter, loginRules, runValidation, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/me', protect, profileRules, runValidation, updateMe);
router.put('/password', protect, loginLimiter, changePasswordRules, runValidation, changePassword);

router.post('/forgot-password', passwordResetLimiter, forgotPasswordRules, runValidation, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPasswordRules, runValidation, resetPassword);

// Saved delivery addresses (the signed-in customer's own).
router.get('/addresses', protect, listAddresses);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:id', protect, updateAddress);
router.patch('/addresses/:id/default', protect, setDefaultAddress);
router.delete('/addresses/:id', protect, deleteAddress);

export default router;
