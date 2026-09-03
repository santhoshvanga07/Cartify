import User from '../models/User.js';

/**
 * @desc    List users, optionally filtered by role
 * @route   GET /api/users?role=admin
 * @access  Admin, Super Admin
 */
export const listUsers = async (req, res) => {
  const filter = req.query.role ? { role: req.query.role } : {};
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: users.length, users });
};

/**
 * @desc    Create an admin account
 * @route   POST /api/users/admins
 * @access  Super Admin only
 *
 * This is the ONLY way an admin can come into existence through the API -
 * /auth/register can never produce one.
 */
export const createAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.findOne({ email })) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const admin = await User.create({ name, email, password, role: 'admin' });

  res.status(201).json({
    success: true,
    user: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
};

/**
 * @desc    Change a user's role
 * @route   PATCH /api/users/:id/role
 * @access  Super Admin only
 */
export const updateUserRole = async (req, res) => {
  const { role } = req.body;

  if (!['customer', 'admin', 'superadmin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  // Guard: never let a Super Admin demote themselves and lock everyone out.
  if (req.params.id === req.user.id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot change your own role' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  user.role = role;
  await user.save();

  res.status(200).json({ success: true, user: { _id: user._id, email: user.email, role: user.role } });
};

/**
 * @desc    Activate or suspend an account
 * @route   PATCH /api/users/:id/status
 * @access  Super Admin only
 */
export const updateUserStatus = async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be true or false' });
  }

  // Guard: suspending yourself would lock you out immediately.
  if (req.params.id === req.user.id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot suspend yourself' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  user.isActive = isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: isActive ? 'Account activated' : 'Account suspended',
    user: { _id: user._id, email: user.email, isActive: user.isActive },
  });
};
