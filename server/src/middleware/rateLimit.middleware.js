import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Rate limiters, in one place so the numbers are easy to review.
 *
 * The point of limiting login is to make password GUESSING expensive.
 * It is not to cap how often a legitimate person may sign in - so three
 * choices follow from that:
 *
 *   1. skipSuccessfulRequests: only FAILED attempts count. Signing in
 *      correctly ten times in a row is not an attack.
 *   2. Login and register get SEPARATE budgets. Creating an account should
 *      not use up the allowance for signing into it.
 *   3. Development gets far higher limits. Locking yourself out of your own
 *      app while building it is not security, it is an obstacle - and it
 *      teaches you to disable the limiter, which is worse.
 */

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 100,
  skipSuccessfulRequests: true, // the key fix - only wrong passwords count
  message: {
    success: false,
    message: 'Too many failed sign-in attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProduction ? 10 : 100,
  message: {
    success: false,
    message: 'Too many accounts created from this address. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Applied to every /api route as a blanket abuse guard. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 600 : 5000,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** AI calls cost money upstream, so they keep a tight per-minute budget. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 15 : 60,
  message: { success: false, message: 'Too many AI requests - please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
