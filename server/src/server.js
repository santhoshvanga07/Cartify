import 'dotenv/config'; // must run BEFORE anything reads process.env
import app from './app.js';
import connectDB from './config/db.js';
import ensureSuperAdmin from './utils/ensureSuperAdmin.js';
import seedCatalog from './utils/seedCatalog.js';
import seedOrders from './utils/seedOrders.js';
import seedReviews from './utils/seedReviews.js';
import seedProductImages from './utils/seedProductImages.js';
import seedCoupons from './utils/seedCoupons.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // In development the fallback DB is empty on every restart, so make sure
  // there is always a Super Admin to log in as.
  if (process.env.NODE_ENV !== 'production') {
    await ensureSuperAdmin();
    await seedCatalog();
    await seedOrders();  // sample orders so the dashboard has data
    await seedReviews();       // real reviews, then ratings recalculated from them
    await seedProductImages(); // placeholder artwork for products with no photo
    await seedCoupons();       // WELCOME10 and FLAT500 for trying checkout
  }

  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode`);
    console.log(`http://localhost:${PORT}/api/health`);
  });
};

startServer();
