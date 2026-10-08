import mongoose from 'mongoose';

/**
 * Platform-wide settings, managed by the Super Admin.
 *
 * A single document (key "platform"). Defaults here are the values the store
 * ran on before settings existed, so an empty database behaves exactly as
 * the hard-coded constants used to.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true, immutable: true },

    // Branding and the seller block printed on invoices.
    storeName: { type: String, trim: true, default: 'Cartify', maxlength: 40 },
    legalName: { type: String, trim: true, default: 'Cartify Retail Pvt. Ltd.', maxlength: 100 },
    address: { type: String, trim: true, default: 'Software Engineering Lab, NIT Campus', maxlength: 200 },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '36ABCDE1234F1Z5',
      match: [/^[0-9]{2}[A-Z0-9]{13}$/, 'GSTIN must be 15 characters'],
    },
    supportEmail: { type: String, trim: true, lowercase: true, default: 'support@cartify.com' },

    // Money rules. Read by pricing.js on every cart and checkout.
    gstRate: { type: Number, default: 18, min: 0, max: 28 }, // percent
    shippingFlat: { type: Number, default: 99, min: 0, max: 1000 },
    freeShippingAbove: { type: Number, default: 5000, min: 0 },

    // Payment methods offered at checkout. Razorpay still needs its keys.
    codEnabled: { type: Boolean, default: true },
    onlinePaymentEnabled: { type: Boolean, default: true },

    returnWindowDays: { type: Number, default: 7, min: 0, max: 30 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
