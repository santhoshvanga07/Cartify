import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { calculateTotals } from './pricing.js';

const NAMES = [
  'Aarav Sharma', 'Diya Patel', 'Vihaan Reddy', 'Ananya Nair', 'Arjun Menon',
  'Ishita Rao', 'Kabir Singh', 'Meera Iyer', 'Rohan Gupta', 'Sara Khan',
];

const CITIES = [
  ['Hyderabad', 'Telangana', '500081'],
  ['Bengaluru', 'Karnataka', '560001'],
  ['Mumbai', 'Maharashtra', '400001'],
  ['Chennai', 'Tamil Nadu', '600001'],
  ['Pune', 'Maharashtra', '411001'],
];

// Weighted so the dashboard shows a realistic funnel, not an even split.
const STATUS_MIX = [
  'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
  'shipped', 'shipped', 'confirmed', 'confirmed', 'placed', 'cancelled',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

/**
 * Creates sample customers and historical orders so the admin dashboard and
 * the analytics charts have something to aggregate.
 *
 * DEVELOPMENT ONLY - never call this in production. It writes fake revenue.
 */
const seedOrders = async ({ orderCount = 40 } = {}) => {
  if ((await Order.countDocuments()) > 0) return { skipped: true };

  const products = await Product.find({ isActive: true });
  if (products.length === 0) return { skipped: true, reason: 'no products' };

  // Customers, spread over the last 6 months so growth has a shape.
  const customers = [];
  for (let i = 0; i < NAMES.length; i++) {
    const monthsAgo = Math.floor((NAMES.length - i) / 2);
    const createdAt = new Date(Date.now() - monthsAgo * 30 * 24 * 3600 * 1000);

    const user = await User.create({
      name: NAMES[i],
      email: `${NAMES[i].split(' ')[0].toLowerCase()}${i}@example.com`,
      password: 'password123',
      role: 'customer',
    });
    /**
     * Mongoose marks createdAt IMMUTABLE when timestamps are on, and silently
     * drops it from any update - even with { timestamps: false }. That is the
     * right default for real data, so instead of weakening the schema we go
     * around it through the raw driver, which applies no Mongoose rules.
     * Backdating fixtures is exactly the narrow case that justifies this.
     */
    await User.collection.updateOne({ _id: user._id }, { $set: { createdAt } });
    customers.push(user);
  }

  for (let i = 0; i < orderCount; i++) {
    const customer = pick(customers);
    const [city, state, pincode] = pick(CITIES);
    const status = pick(STATUS_MIX);
    const daysAgo = randInt(0, 29);
    const placedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - randInt(0, 23) * 3600 * 1000);

    // One to three distinct products per order.
    const chosen = [];
    for (let n = 0; n < randInt(1, 3); n++) {
      const p = pick(products);
      if (!chosen.some((c) => c._id.equals(p._id))) chosen.push(p);
    }

    const items = chosen.map((p) => ({
      product: p._id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      image: p.images?.[0]?.url || '',
      price: p.price, // snapshot
      quantity: randInt(1, 2),
    }));

    const pricing = calculateTotals(items.map((i) => ({ price: i.price, quantity: i.quantity })));

    const order = await Order.create({
      user: customer._id,
      items,
      shippingAddress: {
        fullName: customer.name,
        phone: `9${randInt(100000000, 999999999)}`,
        line1: `${randInt(1, 200)} Main Road`,
        city,
        state,
        pincode,
      },
      pricing: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        gst: pricing.gst,
        shipping: pricing.shipping,
        total: pricing.total,
      },
      paymentMethod: Math.random() < 0.6 ? 'cod' : 'razorpay',
      paymentStatus: status === 'delivered' ? 'paid' : status === 'cancelled' ? 'refunded' : 'pending',
      status,
      statusHistory: [{ status: 'placed', at: placedAt, note: 'Order placed' }],
    });

    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: placedAt } });
  }

  console.log(`Sample data seeded: ${customers.length} customers, ${orderCount} orders`);
  return { customers: customers.length, orders: orderCount };
};

export default seedOrders;
