import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import aiRoutes from './routes/ai.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import reviewRoutes from './routes/review.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();

/* ---------- Security & parsing (order matters) ---------- */

// 1. Security headers first - applies to every response, including errors.
app.use(helmet());

// 2. Who is allowed to call this API from a browser.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // required for cookies to cross origins
  })
);

// 3. Parse JSON bodies. The limit blocks huge-payload denial of service.
app.use(express.json({ limit: '10kb' }));

// 4. Parse the Cookie header into req.cookies - protect() depends on this.
app.use(cookieParser());

/* ---------- Routes ---------- */

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);

/* ---------- Error handling (must be LAST) ---------- */

app.use(notFound);
app.use(errorHandler);

export default app;
