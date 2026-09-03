import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import ensureSuperAdmin from '../src/utils/ensureSuperAdmin.js';

/* Run with: npm run seed:admin */
const run = async () => {
  await connectDB();
  const admin = await ensureSuperAdmin();
  console.log(admin ? `Ready: ${admin.email} (${admin.role})` : 'SEED_SUPERADMIN_EMAIL not set');
  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  await mongoose.connection.close();
  process.exit(1);
});
