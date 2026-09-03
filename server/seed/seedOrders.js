import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import seedOrders from '../src/utils/seedOrders.js';

/* Run with: npm run seed:orders  (development only) */
const run = async () => {
  await connectDB();
  const result = await seedOrders();
  console.log(result.skipped ? 'Orders already exist - nothing to do.' : 'Done.');
  await mongoose.connection.close();
};

run().catch(async (e) => {
  console.error('Seed failed: ' + e.message);
  await mongoose.connection.close();
  process.exit(1);
});
