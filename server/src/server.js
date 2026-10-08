import 'dotenv/config'; // must run BEFORE anything reads process.env
import app from './app.js';
import connectDB from './config/db.js';
import { loadSettings } from './services/settings.service.js';
import ensureSuperAdmin from './utils/ensureSuperAdmin.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
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

  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode`);
    console.log(`http://localhost:${PORT}/api/health`);
  });
};

startServer();
