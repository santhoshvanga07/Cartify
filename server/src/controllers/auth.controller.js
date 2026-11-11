import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { checkEmailAddress } from '../utils/emailCheck.js';
import sendTokenResponse, { authCookieOptions } from '../utils/sendTokenResponse.js';
import {
  notifyWelcome, notifyPasswordReset, notifyPasswordChanged, notifyLogin, notifySignupCode,
} from '../services/notification.service.js';
import { logActivity } from '../services/activity.service.js';

const RESET_MINUTES = 30;

const SIGNUP_CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 30;

/** 000000-999999, from a cryptographically secure source. */
const newSignupCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
/** Stored instead of the code itself. Keyed with the server secret, so a leaked database reveals nothing. */
const hashSignupCode = (email, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Sign-up checks the email (6-digit code) unless the operator turned that off (REQUIRE_EMAIL_VERIFICATION=false). */
const emailVerificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists. Sign in, or use "Forgot password".',
    });
  }

  /**
   * With email checking on (the default), nothing is created yet. We check the
   * address can receive mail, then email a 6-digit code; the account is made
   * only when that code comes back (verifySignup). A made-up address never
   * becomes an account.
   */
  if (emailVerificationRequired()) {
    const check = await checkEmailAddress(email);
    if (!check.ok) {
      return res.status(400).json({ success: false, message: check.message, suggestion: check.suggestion });
    }
    const code = newSignupCode();
    await PendingSignup.findOneAndUpdate(
      { email },
      {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        codeHash: hashSignupCode(email, code),
        attempts: 0,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + SIGNUP_CODE_MINUTES * 60 * 1000),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    notifySignupCode({ name, email }, code, SIGNUP_CODE_MINUTES);
    return res.status(202).json({
      success: true,
      pending: true,
      email,
      message: `We sent a 6-digit code to ${email}. Enter it to finish creating your account.`,
    });
  }

  // Email checking switched off (local experiments): create the account straight away.
  // NOTE: role is deliberately NOT taken from req.body.
  const user = await User.create({ name, email, password });
  notifyWelcome(user);

  sendTokenResponse(user, 201, res);
};

/**
 * @desc    Log in
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  // password has select:false, so ask for it explicitly
  const user = await User.findOne({ email }).select('+password');

  // Same message whether the email or the password was wrong (see notes)
  if (!user || !(await user.matchPassword(password))) {
    // Logged with the attempted email, so repeated guessing at one account shows up.
    logActivity(req, 'auth.login_failed', { type: 'user', id: user?._id, label: email }, '', null);
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    logActivity(req, 'auth.login_blocked', { type: 'user', id: user._id, label: email }, 'Suspended account', null);
    return res.status(403).json({ success: false, message: 'Account suspended' });
  }

  logActivity(req, 'auth.login', { type: 'user', id: user._id, label: email }, '', user);
  notifyLogin(user, { ip: req.ip, userAgent: req.get('user-agent') });
  sendTokenResponse(user, 200, res);
};

/**
 * @desc    Log out
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = (req, res) => {
  // Same attributes as when it was set, or the browser keeps the old cookie.
  res.clearCookie('token', authCookieOptions());
  res.status(200).json({ success: true, message: 'Logged out' });
};

/**
 * @desc    Get the currently logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};

/**
 * @desc    Update your own profile (name only - email is your login)
 * @route   PUT /api/auth/me
 * @access  Private
 */
export const updateMe = async (req, res) => {
  // Whitelist, not Object.assign(req.body): role and isActive must never
  // be settable from here.
  req.user.name = req.body.name;
  await req.user.save();
  res.status(200).json({ success: true, user: req.user });
};

/**
 * @desc    Change password while signed in
 * @route   PUT /api/auth/password
 * @access  Private
 */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save(); // pre-save hashes it and stamps passwordChangedAt
  notifyPasswordChanged(user);
  logActivity(req, 'auth.password_change', { type: 'user', id: user._id, label: user.email });

  // A fresh cookie for THIS device; every other session is now invalid.
  sendTokenResponse(user, 200, res);
};

/**
 * @desc    Email a password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 *
 * Always answers the same way, whether or not the email has an account.
 * Otherwise this endpoint would tell anyone which addresses are registered.
 */
export const forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });

  if (user) {
    const raw = user.createPasswordResetToken(RESET_MINUTES);
    await user.save({ validateBeforeSave: false });
    const url = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${raw}`;
    notifyPasswordReset(user, url, RESET_MINUTES);
  }

  res.status(200).json({
    success: true,
    message: 'If that email has an account, a reset link is on its way.',
  });
};

/**
 * @desc    Set a new password using the emailed token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: new Date() },
  });
  if (!user) {
    return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account suspended' });
  }

  user.password = req.body.password;
  // Single use: clear the token the moment it is spent.
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  notifyPasswordChanged(user);
  logActivity(req, 'auth.password_reset', { type: 'user', id: user._id, label: user.email }, '', user);

  sendTokenResponse(user, 200, res);
};

/**
 * @desc    Finish sign-up with the emailed 6-digit code
 * @route   POST /api/auth/register/verify   body: { email, code }
 * @access  Public
 */
export const verifySignup = async (req, res) => {
  const { email, code } = req.body;
  const pending = await PendingSignup.findOne({ email });
  if (!pending || pending.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: 'This code has expired. Please sign up again to get a new one.' });
  }
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    await pending.deleteOne();
    return res.status(400).json({ success: false, message: 'Too many wrong codes. Please sign up again.' });
  }
  if (!sameHash(hashSignupCode(email, String(code)), pending.codeHash)) {
    pending.attempts += 1;
    await pending.save();
    const left = MAX_CODE_ATTEMPTS - pending.attempts;
    return res.status(400).json({
      success: false,
      message: left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Please sign up again.',
    });
  }

  // Someone finished signing up with this email in the meantime.
  if (await User.exists({ email })) {
    await pending.deleteOne();
    return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
  }

  // NOTE: role is deliberately NOT taken from the request - a new account is always a customer.
  const user = new User({ name: pending.name, email, password: pending.passwordHash, emailVerified: true });
  user.$locals.passwordIsHashed = true;
  await user.save();
  await pending.deleteOne();

  notifyWelcome(user);
  logActivity(req, 'auth.register', { type: 'user', id: user._id, label: user.email }, 'email confirmed by code', user);
  sendTokenResponse(user, 201, res);
};

/**
 * @desc    Send a fresh sign-up code
 * @route   POST /api/auth/register/resend   body: { email }
 * @access  Public
 */
export const resendSignupCode = async (req, res) => {
  const pending = await PendingSignup.findOne({ email: req.body.email });
  if (!pending) {
    return res.status(400).json({ success: false, message: 'Please start signing up again.' });
  }
  const wait = Math.ceil(RESEND_AFTER_SECONDS - (Date.now() - pending.sentAt.getTime()) / 1000);
  if (wait > 0) {
    return res.status(429).json({ success: false, message: `Please wait ${wait} seconds before asking for another code.` });
  }
  const code = newSignupCode();
  pending.codeHash = hashSignupCode(pending.email, code);
  pending.attempts = 0;
  pending.sentAt = new Date();
  pending.expiresAt = new Date(Date.now() + SIGNUP_CODE_MINUTES * 60 * 1000);
  await pending.save();
  notifySignupCode(pending, code, SIGNUP_CODE_MINUTES);
  res.status(200).json({ success: true, message: `We sent a new code to ${pending.email}.` });
};
