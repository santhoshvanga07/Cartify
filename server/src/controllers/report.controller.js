import Order, { COUNTS_AS_SALE } from '../models/Order.js';
import Product from '../models/Product.js';
import { sendCsv } from '../utils/csv.js';
import { logActivity } from '../services/activity.service.js';

const REVENUE_MATCH = COUNTS_AS_SALE;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to the last 30 days.
 * `to` is inclusive - the whole of that day counts. Days are Indian days
 * (IST), the same calendar the per-day grouping below uses.
 */
const dateRange = (req) => {
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:30`) : new Date();
  const from = req.query.from ? new Date(`${req.query.from}T00:00:00.000+05:30`) : new Date(to.getTime() - 30 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    const err = new Error('Invalid date range');
    err.statusCode = 400;
    throw err;
  }
  if (to - from > 366 * DAY) {
    const err = new Error('Reports cover at most one year');
    err.statusCode = 400;
    throw err;
  }
  return { from, to };
};

/** YYYY-MM-DD in India time (the report's own calendar), for file names. */
const stamp = (d) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const wantsCsv = (req) => req.query.format === 'csv';

/** Shared reply: JSON for the on-screen preview, CSV for the download. */
const reply = (req, res, name, columns, rows, summary) => {
  if (wantsCsv(req)) {
    logActivity(req, 'report.export', { type: 'report', label: name }, `${rows.length} rows`);
    return sendCsv(res, `cartify-${name}.csv`, columns, rows);
  }
  res.status(200).json({ success: true, columns, rows, summary });
};

/**
 * @route GET /api/reports/sales?from&to&format=csv
 * One row per day: orders, units, gross, discount, GST, shipping, net.
 */
export const salesReport = async (req, res) => {
  const { from, to } = dateRange(req);

  const rows = await Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        orders: { $sum: 1 },
        units: { $sum: { $sum: '$items.quantity' } },
        gross: { $sum: '$pricing.subtotal' },
        discount: { $sum: '$pricing.discount' },
        gst: { $sum: '$pricing.gst' },
        shipping: { $sum: '$pricing.shipping' },
        net: { $sum: '$pricing.total' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0, date: '$_id', orders: 1, units: 1,
        gross: { $round: ['$gross', 2] }, discount: { $round: ['$discount', 2] },
        gst: { $round: ['$gst', 2] }, shipping: { $round: ['$shipping', 2] }, net: { $round: ['$net', 2] },
      },
    },
  ]);

  const sum = (k) => Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100;
  reply(
    req, res, `sales-${stamp(from)}-to-${stamp(to)}`,
    [
      { key: 'date', label: 'Date' }, { key: 'orders', label: 'Orders' }, { key: 'units', label: 'Units' },
      { key: 'gross', label: 'Gross (Rs)' }, { key: 'discount', label: 'Discount (Rs)' },
      { key: 'gst', label: 'GST (Rs)' }, { key: 'shipping', label: 'Shipping (Rs)' }, { key: 'net', label: 'Net (Rs)' },
    ],
    rows,
    { orders: sum('orders'), units: sum('units'), net: sum('net'), gst: sum('gst'), discount: sum('discount') }
  );
};

/** @route GET /api/reports/orders?from&to&format=csv  - every order, any status */
export const ordersReport = async (req, res) => {
  const { from, to } = dateRange(req);

  const orders = await Order.find({ createdAt: { $gte: from, $lte: to } })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: o.createdAt,
    customer: o.user?.name,
    email: o.user?.email,
    city: o.shippingAddress?.city,
    state: o.shippingAddress?.state,
    items: o.items.reduce((n, i) => n + i.quantity, 0),
    subtotal: o.pricing.subtotal,
    discount: o.pricing.discount,
    coupon: o.coupon?.code || '',
    gst: o.pricing.gst,
    shipping: o.pricing.shipping,
    total: o.pricing.total,
    payment: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
  }));

  reply(
    req, res, `orders-${stamp(from)}-to-${stamp(to)}`,
    [
      { key: 'orderNumber', label: 'Order' }, { key: 'date', label: 'Placed at' },
      { key: 'customer', label: 'Customer' }, { key: 'email', label: 'Email' },
      { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'items', label: 'Units' },
      { key: 'subtotal', label: 'Subtotal' }, { key: 'discount', label: 'Discount' }, { key: 'coupon', label: 'Coupon' },
      { key: 'gst', label: 'GST' }, { key: 'shipping', label: 'Shipping' }, { key: 'total', label: 'Total' },
      { key: 'payment', label: 'Payment' }, { key: 'paymentStatus', label: 'Payment status' },
      { key: 'status', label: 'Status' },
    ],
    rows,
    { orders: rows.length }
  );
};

/**
 * @route GET /api/reports/products?from&to&format=csv
 * Every active product with units sold and revenue in the range - including
 * products that sold nothing, which is often the most useful line.
 */
export const productsReport = async (req, res) => {
  const { from, to } = dateRange(req);

  const [products, sales] = await Promise.all([
    Product.find({ isActive: true }).populate('category', 'name').lean(),
    Order.aggregate([
      { $match: { ...REVENUE_MATCH, createdAt: { $gte: from, $lte: to } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          units: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
    ]),
  ]);

  const byId = new Map(sales.map((s) => [String(s._id), s]));
  const rows = products
    .map((p) => {
      const s = byId.get(String(p._id));
      return {
        name: p.name, brand: p.brand, category: p.category?.name, price: p.price, stock: p.stock,
        rating: p.ratingAvg, reviews: p.numReviews,
        units: s?.units || 0, revenue: Math.round((s?.revenue || 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  reply(
    req, res, `products-${stamp(from)}-to-${stamp(to)}`,
    [
      { key: 'name', label: 'Product' }, { key: 'brand', label: 'Brand' }, { key: 'category', label: 'Category' },
      { key: 'price', label: 'Price' }, { key: 'stock', label: 'Stock' }, { key: 'units', label: 'Units sold' },
      { key: 'revenue', label: 'Revenue (Rs)' }, { key: 'rating', label: 'Rating' }, { key: 'reviews', label: 'Reviews' },
    ],
    rows,
    { products: rows.length, unsold: rows.filter((r) => r.units === 0).length, lowStock: rows.filter((r) => r.stock <= 5).length }
  );
};
