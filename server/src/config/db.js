import mongoose from 'mongoose';

const isValidUri = (uri) => /^mongodb(\+srv)?:\/\//.test(uri || '');

/**
 * Starts a throwaway in-memory MongoDB.
 * DEVELOPMENT ONLY - delete this function and its two call sites once every
 * machine on the team can reach Atlas.
 */
// Held so we can stop it again - otherwise the process never exits.
let memoryServer = null;

const startMemoryServer = async (reason) => {
  console.warn('');
  console.warn(`  ${reason}`);
  console.warn('  Falling back to a TEMPORARY in-memory MongoDB.');
  console.warn('  Data is wiped on every restart.');
  console.warn('');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri('cartify');
};

/**
 * Closes the database connection and, if we started a throwaway in-memory
 * server, stops that too.
 *
 * Without stopping it, the mongod child process keeps an active handle open
 * and a one-off script (a seed, a migration) finishes its work and then hangs
 * forever instead of exiting.
 */
export const disconnectDB = async () => {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const isProduction = process.env.NODE_ENV === 'production';

  // Production must never run on a throwaway database.
  if (isProduction && !isValidUri(uri)) {
    console.error('MONGO_URI is missing or invalid. Refusing to start in production.');
    process.exit(1);
  }

  try {
    if (!isValidUri(uri)) {
      const memUri = await startMemoryServer('MONGO_URI is not set.');
      const conn = await mongoose.connect(memUri);
      console.log(`MongoDB connected: ${conn.connection.host} (in-memory)`);
      return conn;
    }

    // serverSelectionTimeoutMS: fail fast instead of hanging for 30 seconds.
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    console.log(`Database name:    ${conn.connection.name}`);
    return conn;
  } catch (error) {
    // A real connection failure. In production this is fatal.
    if (isProduction) {
      console.error(`MongoDB connection FAILED: ${error.message}`);
      process.exit(1);
    }

    // In development, keep working rather than blocking the whole app.
    console.warn(`Atlas unreachable: ${error.message}`);
    const memUri = await startMemoryServer('Could not reach the configured database.');
    const conn = await mongoose.connect(memUri);
    console.log(`MongoDB connected: ${conn.connection.host} (in-memory)`);
    return conn;
  }
};

export default connectDB;
