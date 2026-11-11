import User from '../models/User.js';
import Order from '../models/Order.js';
import { escapeRegex } from '../services/productQuery.service.js';
import { logActivity } from '../services/activity.service.js';

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

  // Created by a Super Admin for a colleague: treated as already confirmed.
  const admin = await User.create({ name, email, password, role: 'admin', emailVerified: true });
  logActivity(req, 'user.create_admin', { type: 'user', id: admin._id, label: admin.email });

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

  const previous = user.role;
  user.role = role;
  await user.save();
  logActivity(req, 'user.role', { type: 'user', id: user._id, label: user.email }, `${previous} -> ${role}`);

  res.status(200).json({ success: true, user: { _id: user._id, email: user.email, role: user.role } });
};

/**
 * @desc    Customers with their order count and lifetime spend
 * @route   GET /api/users/customers?q=&page=
 * @access  Admin, Super Admin
 *
 * One aggregation with a $lookup rather than a query per customer.
 * Spend excludes cancelled and returned orders - money that came back.
 */
export const listCustomers = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const q = String(req.query.q || '').trim();

  const match = { role: 'customer' };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    match.$or = [{ name: rx }, { email: rx }];
  }

  const [total, customers] = await Promise.all([
    User.countDocuments(match),
    User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: Order.collection.name,
          let: { uid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$uid'] } } },
            {
              $group: {
                _id: null,
                orders: { $sum: 1 },
                spent: {
                  $sum: {
                    // Same rule as COUNTS_AS_SALE: unpaid online orders are not money spent.
                    $cond: [
                      {
                        $or: [
                          { $in: ['$status', ['cancelled', 'returned']] },
                          { $and: [{ $eq: ['$paymentMethod', 'razorpay'] }, { $ne: ['$paymentStatus', 'paid'] }] },
                        ],
                      },
                      0,
                      '$pricing.total',
                    ],
                  },
                },
                lastOrderAt: { $max: '$createdAt' },
              },
            },
          ],
          as: 'stats',
        },
      },
      {
        $project: {
          name: 1, email: 1, isActive: 1, createdAt: 1,
          orders: { $ifNull: [{ $first: '$stats.orders' }, 0] },
          spent: { $round: [{ $ifNull: [{ $first: '$stats.spent' }, 0] }, 2] },
          lastOrderAt: { $first: '$stats.lastOrderAt' },
        },
      },
    ]),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), customers });
};

/**
 * @desc    Activate or suspend an account
 * @route   PATCH /api/users/:id/status
 * @access  Admin (customers only), Super Admin (anyone)
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

  // An admin manages shoppers. Suspending a fellow admin - or the Super Admin
  // above them - is a Super Admin decision.
  if (req.user.role !== 'superadmin' && user.role !== 'customer') {
    return res.status(403).json({ success: false, message: 'Only a Super Admin can suspend staff accounts' });
  }

  user.isActive = isActive;
  await user.save();
  logActivity(req, isActive ? 'user.activate' : 'user.suspend', { type: 'user', id: user._id, label: user.email });

  res.status(200).json({
    success: true,
    message: isActive ? 'Account activated' : 'Account suspended',
    user: { _id: user._id, email: user.email, isActive: user.isActive },
  });
};
