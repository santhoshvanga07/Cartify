import crypto from 'node:crypto';
import mongoose from 'mongoose';

/**
 * A SNAPSHOT of the product at the moment of purchase.
 *
 * We keep the ref for linking, but we also COPY name, brand, price and image.
 * If an admin later changes the price or deletes the product, this order and
 * its invoice must still show what the customer actually paid. Storing only a
 * ref would silently rewrite every historical invoice.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    brand: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true }, // price AT PURCHASE TIME
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, default: '', maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    pincode: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'return_requested',
  'returned',
];

/**
 * Orders that count as real sales: not cancelled or returned, and - for online
 * payment - actually paid. An abandoned Razorpay checkout is not revenue.
 * Shared by analytics, reports, customer spend and the recommendation shelves.
 */
export const COUNTS_AS_SALE = {
  status: { $nin: ['cancelled', 'returned'] },
  $nor: [{ paymentMethod: 'razorpay', paymentStatus: { $ne: 'paid' } }],
};

/** Which transitions an admin is allowed to make. Prevents delivered -> placed. */
export const ALLOWED_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: [],
  cancelled: [],
};

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Human-readable reference. Nobody wants to read an ObjectId over the phone.
    orderNumber: { type: String, unique: true, index: true },

    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: addressSchema, required: true },

    // Recomputed on the server at checkout - never taken from the client.
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      gst: { type: Number, required: true },
      shipping: { type: Number, required: true },
      total: { type: Number, required: true },
      // The rate in force when the order was placed. Orders from before
      // GST became configurable were all charged 18%.
      gstRate: { type: Number, default: 18 },
    },

    // The coupon as it was applied - a later edit to the coupon must not
    // change what this invoice says.
    coupon: {
      code: String,
      discount: Number,
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    },

    paymentMethod: { type: String, enum: ['cod', 'razorpay'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      razorpayOrderId: String, // the latest attempt
      // Every attempt ("Retry payment" creates a new Razorpay order). A shopper
      // can still complete an OLD attempt's checkout window, so all of them
      // must be recognised - and checked for money before the order is cancelled.
      razorpayOrderIds: { type: [String], default: [] },
      razorpayPaymentId: String,
      razorpaySignature: String,
      paidAt: Date,
    },

    status: { type: String, enum: ORDER_STATUSES, default: 'placed', index: true },

    // Starts the return window. Set once, the first time the order is delivered.
    deliveredAt: Date,
    returnReason: { type: String, maxlength: 500 },

    // An audit trail - who changed what, when. Needed for the admin activity log.
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        at: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// No 0/O or 1/I - order numbers get read out over the phone.
const ORDER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a readable order number: CFY-250820-7K4QM2
 *
 * Six characters from a 32-letter alphabet give about a billion values per
 * day. Four random digits (9,000 values) collide surprisingly early - by the
 * birthday paradox, ~110 orders in one day already give even odds of a clash,
 * and the unique index then rejects a perfectly good checkout.
 */
orderSchema.pre('save', async function () {
  if (this.orderNumber) return;
  const d = this.createdAt || new Date();
  const stamp =
    String(d.getFullYear()).slice(2) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const random = Array.from(crypto.randomBytes(6), (b) => ORDER_ALPHABET[b % 32]).join('');
  this.orderNumber = `CFY-${stamp}-${random}`;
});

export default mongoose.model('Order', orderSchema);
