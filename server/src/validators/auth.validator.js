import { body, validationResult } from 'express-validator';

/* Turns express-validator's collected errors into our standard JSON shape. */
export const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

export const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().withMessage('Password must be text')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const newPasswordRule = (field) =>
  body(field).isString().withMessage('Password must be text')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters');

export const profileRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters'),
];

export const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('Enter your current password'),
  newPasswordRule('newPassword'),
];

export const forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const resetPasswordRules = [newPasswordRule('password')];

export const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isString().withMessage('Password is required').notEmpty().withMessage('Password is required'),
];

/** Sign-up step 2. The email is normalised exactly like registration, so the pending sign-up is found. */
export const signupCodeRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('code').isString().withMessage('Enter the 6-digit code').trim()
    .matches(/^\d{6}$/).withMessage('The code is 6 digits'),
];
