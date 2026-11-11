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
import questionRoutes from './routes/question.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import reportRoutes from './routes/report.routes.js';
import contactRoutes from './routes/contact.routes.js';
import { refreshSettings } from './services/settings.service.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';

const app = express();

// Render and Vercel sit behind one proxy hop. Trusting exactly one makes
// req.ip the real client address (used by rate limits and the audit log)
// without letting a client spoof it with its own X-Forwarded-For header.
app.set('trust proxy', 1);

/* ---------- Security & parsing (order matters) ---------- */

// 1. Security headers first - applies to every response, including errors.
app.use(helmet());

// 2. Who is allowed to call this API from a browser.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // required for cookies to cross origins
    // Lets the browser read the report filename on a cross-origin download.
    exposedHeaders: ['Content-Disposition'],
  })
);

// 3. Parse JSON bodies. The limit blocks huge-payload denial of service.
app.use(express.json({ limit: '10kb' }));

// 4. Parse the Cookie header into req.cookies - protect() depends on this.
app.use(cookieParser());

/* ---------- Routes ---------- */

// Blanket abuse guard; tighter limiters sit on login, register, AI and resets.
app.use('/api', apiLimiter);
app.use('/api', refreshSettings); // keeps GST/shipping rates current

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
app.use('/api/questions', questionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/contact', contactRoutes);

/* ---------- Error handling (must be LAST) ---------- */

app.use(notFound);
app.use(errorHandler);

export default app;
