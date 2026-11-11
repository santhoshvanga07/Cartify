import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { runValidation } from '../validators/auth.validator.js';
import { notifyContactMessage } from '../services/notification.service.js';

const router = Router();

/** A contact form is an easy way to spam the store's inbox - keep it tight. */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { success: false, message: 'Too many messages - please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/contact   body: { name, email, orderNumber?, message }
 * @access Public
 * Emails the store's staff, and sends the customer an acknowledgement.
 */
router.post(
  '/',
  contactLimiter,
  [
    body('name').isString().trim().notEmpty().withMessage('Tell us your name').isLength({ max: 60 }),
    body('email').isString().trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('orderNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 40 }),
    body('message').isString().trim().isLength({ min: 10, max: 2000 })
      .withMessage('Please write at least a sentence (10 characters)'),
  ],
  runValidation,
  async (req, res) => {
    const { name, email, orderNumber, message } = req.body;
    await notifyContactMessage({ name, email, orderNumber, message });
    res.status(200).json({ success: true, message: 'Thanks - we have your message and will reply by email.' });
  }
);

export default router;
