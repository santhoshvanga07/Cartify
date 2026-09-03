import User from '../models/User.js';
import sendTokenResponse from '../utils/sendTokenResponse.js';

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
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account suspended' });
  }

  sendTokenResponse(user, 200, res);
};

/**
 * @desc    Log out
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0), // already expired -> browser deletes it
  });
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
