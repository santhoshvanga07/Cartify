import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import seedCatalog from '../src/utils/seedCatalog.js';

/* Run with: npm run seed:catalog */
const run = async () => {
  await connectDB();
  const result = await seedCatalog();
  console.log(result.skipped ? 'Products already exist - nothing to do.' : 'Done.');
  await mongoose.connection.close();
};

run().catch(async (e) => {
  console.error('Seed failed: ' + e.message);
  await mongoose.connection.close();
  process.exit(1);
});
