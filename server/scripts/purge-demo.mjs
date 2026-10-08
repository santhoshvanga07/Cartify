import 'dotenv/config';
import mongoose from 'mongoose';
import purgeDemoData from './purgeDemoData.js';

/*
 * Run with:  npm run purge:demo          (dry run - shows what would go)
 *            npm run purge:demo -- --yes (actually deletes)
 *
 * Point MONGO_URI in server/.env at the database you want to clean first.
 *
 * Connects with mongoose directly rather than connectDB(): connectDB falls
 * back to a throwaway in-memory database when Atlas is unreachable, and a
 * clean-up that "succeeds" against the wrong database is worse than one
 * that fails loudly.
 */
if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGO_URI || '')) {
  console.error('Set MONGO_URI in server/.env to the database you want to clean.');
  process.exit(1);
}

try {
  const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected to ${conn.connection.host} / ${conn.connection.name}\n`);
  await purgeDemoData({ apply: process.argv.includes('--yes') });
} catch (err) {
  console.error(`Purge failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
