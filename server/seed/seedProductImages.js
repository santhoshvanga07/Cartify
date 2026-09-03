import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import seedProductImages from '../src/utils/seedProductImages.js';

/* Run with: npm run seed:images */
const run = async () => {
  await connectDB();
  const result = await seedProductImages();
  console.log(result.skipped ? 'Every product already has an image.' : 'Done.');
  await mongoose.connection.close();
};

run().catch(async (e) => {
  console.error('Seed failed: ' + e.message);
  await mongoose.connection.close();
  process.exit(1);
});
