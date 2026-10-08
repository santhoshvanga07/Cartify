import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { isRazorpayConfigured } from '../services/payment.service.js';
import { isEmailConfigured } from '../services/email.service.js';
import { isAiConfigured } from '../services/ai.service.js';

const router = Router();

// GET /api/health  -> is the server alive?
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cartify API is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/integrations  -> which third-party keys are set?
 * Staff only. Reports yes/no per integration - never the keys themselves -
 * so the dashboard can say "uploads are off: add Cloudinary keys" instead of
 * letting an admin discover it through a failed upload.
 */
router.get('/integrations', protect, authorize('admin', 'superadmin'), (req, res) => {
  res.status(200).json({
    success: true,
    integrations: {
      cloudinary: isCloudinaryConfigured(),
      razorpay: isRazorpayConfigured(),
      email: isEmailConfigured(),
      ai: isAiConfigured(),
      database: /^mongodb(\+srv)?:\/\//.test(process.env.MONGO_URI || '') ? 'atlas' : 'in-memory',
    },
  });
});

export default router;
