import validator from 'validator';
import User from '../models/User.js';

/** Creates one staff account if it does not already exist. Idempotent. */
const ensureStaffUser = async ({ name, email: rawEmail, password, role }) => {
  if (!rawEmail || !password) return null;

  /**
   * Store the address exactly as login will look it up. The login validator
   * runs normalizeEmail(), which for Gmail drops dots and "+tags"
   * (m.dheeraj@gmail.com -> mdheeraj@gmail.com). Storing the raw address
   * would lock the account out with "Invalid credentials" forever.
   */
  const email = validator.normalizeEmail(String(rawEmail).trim()) || String(rawEmail).trim().toLowerCase();

  const existing = await User.findOne({ email });
  if (existing) return existing;

  // Staff addresses come from the operator's own config - nothing to confirm.
  const user = await User.create({ name, email, password, role, emailVerified: true });
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
