import 'dotenv/config';
import connectDB, { disconnectDB } from '../src/config/db.js';
import uploadGeneratedImages from '../src/utils/uploadGeneratedImages.js';

/* Run with: npm run seed:upload-images */
const run = async () => {
  await connectDB();
  const result = await uploadGeneratedImages();
  console.log(result.skipped ? `Skipped: ${result.reason}` : 'Done.');
  await disconnectDB();
};

run().catch(async (e) => {
  console.error('Failed: ' + e.message);
  await disconnectDB();
  process.exitCode = 1;
});
