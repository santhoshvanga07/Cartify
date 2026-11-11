import User from '../models/User.js';
import crypto from 'node:crypto';
import sendTokenResponse, { authCookieOptions } from '../utils/sendTokenResponse.js';
import {
  notifyWelcome, notifyPasswordReset, notifyPasswordChanged, notifyLogin, notifyVerifyEmail,
} from '../services/notification.service.js';
import { logActivity } from '../services/activity.service.js';

const RESET_MINUTES = 30;
const VERIFY_HOURS = 24;

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

/** Orders need a confirmed email unless the operator turned that off (REQUIRE_EMAIL_VERIFICATION=false). */
export const emailVerificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';

/** Issues a fresh confirm-your-email link and saves its hash. */
const issueVerifyLink = async (user) => {
  const raw = user.createEmailVerifyToken(VERIFY_HOURS);
  await user.save({ validateBeforeSave: false });
  return `${clientUrl()}/verify-email/${raw}`;
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  // NOTE: role is deliberately NOT taken from req.body.
  const user = await User.create({ name, email, password });
  // The welcome email doubles as the confirm-your-email email.
  notifyWelcome(user, await issueVerifyLink(user), VERIFY_HOURS);

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
 * @desc    Confirm an email address with the emailed link
 * @route   POST /api/auth/verify-email/:token
 * @access  Public (the link may be opened on a device where they are not signed in)
 */
export const verifyEmail = async (req, res) => {
  const hashed = crypto.createHash('sha256').update(String(req.params.token)).digest('hex');
  const user = await User.findOne({ emailVerifyToken: hashed, emailVerifyExpire: { $gt: new Date() } });
  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'This confirmation link is invalid or has expired. Sign in and ask for a new one.',
    });
  }
  user.emailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpire = undefined;
  await user.save({ validateBeforeSave: false });
  logActivity(req, 'auth.email_verified', { type: 'user', id: user._id, label: user.email }, '', user);
  res.status(200).json({ success: true, message: 'Email confirmed - you can now place orders.' });
};

/**
 * @desc    Send a new confirmation link
 * @route   POST /api/auth/verify-email/resend
 * @access  Private
 */
export const resendVerification = async (req, res) => {
  if (req.user.emailVerified) {
    return res.status(400).json({ success: false, message: 'Your email is already confirmed' });
  }
  notifyVerifyEmail(req.user, await issueVerifyLink(req.user), VERIFY_HOURS);
  res.status(200).json({ success: true, message: `We sent a new link to ${req.user.email}` });
};
