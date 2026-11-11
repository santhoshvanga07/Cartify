import 'dotenv/config'; // must run BEFORE anything reads process.env
import app from './app.js';
import connectDB from './config/db.js';
import { loadSettings } from './services/settings.service.js';
import ensureSuperAdmin from './utils/ensureSuperAdmin.js';
import User from './models/User.js';
import { expireUnpaidOrders } from './controllers/order.controller.js';

const PORT = process.env.PORT || 5000;

// How long an online order may wait for its payment before its stock is released.
const UNPAID_ORDER_MINUTES = 30;

const startServer = async () => {
  // Without a secret nobody can sign in (every login would be a 500), so say so now.
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Add it to server/.env (see .env.example). Refusing to start.');
    process.exit(1);
  }

  await connectDB();
  await loadSettings(); // GST, shipping and payment rules for pricing.js

  /**
   * Make sure the staff accounts named in .env exist. Idempotent: an account
   * that already exists is left untouched (including its password), so this
   * is safe in production too - and it means a fresh deployment on a host
   * without shell access still has someone who can sign in to the dashboard.
   *
   * Nothing else is seeded. The store starts empty: admins add categories
   * and products (with photos) from the dashboard.
   */
  await ensureSuperAdmin();

  // Accounts created before email confirmation existed are treated as confirmed,
  // so existing customers are not suddenly blocked from ordering.
  await User.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });

  // Every 5 minutes: cancel online orders left unpaid, so their stock is sold again.
  const sweep = () =>
    expireUnpaidOrders(UNPAID_ORDER_MINUTES)
      .then((n) => n && console.log(`Cancelled ${n} unpaid online order(s)`))
      .catch((err) => console.error(`Unpaid-order sweep failed: ${err.message}`));
  setInterval(sweep, 5 * 60 * 1000).unref();
  sweep();

  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode`);
    console.log(`http://localhost:${PORT}/api/health`);
  });
};

startServer();
