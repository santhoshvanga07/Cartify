import User from '../models/User.js';

/** Creates one staff account if it does not already exist. Idempotent. */
const ensureStaffUser = async ({ name, email, password, role }) => {
  if (!email || !password) return null;

  const existing = await User.findOne({ email });
  if (existing) return existing;

  const user = await User.create({ name, email, password, role });
  console.log(`${role === 'superadmin' ? 'Super Admin' : 'Admin'} created: ${user.email}`);
  return user;
};

/**
 * Seeds the staff accounts.
 *
 * These exist because /api/auth/register can ONLY ever create a customer -
 * that is the mass-assignment defence. So the first privileged accounts have
 * to be planted directly, with the role set here in code rather than
 * accepted from a request.
 *
 * Run by `npm run seed:admin`, and automatically on start in development
 * (where the fallback database is empty after every restart).
 */
const ensureSuperAdmin = async () => {
  const superAdmin = await ensureStaffUser({
    name: process.env.SEED_SUPERADMIN_NAME || 'Super Admin',
    email: process.env.SEED_SUPERADMIN_EMAIL,
    password: process.env.SEED_SUPERADMIN_PASSWORD,
    role: 'superadmin',
  });

  // A plain admin as well, so the difference between the two roles can
  // actually be seen: an admin runs the store, a super admin runs the platform.
  await ensureStaffUser({
    name: process.env.SEED_ADMIN_NAME || 'Store Admin',
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    role: 'admin',
  });

  return superAdmin;
};

export default ensureSuperAdmin;
