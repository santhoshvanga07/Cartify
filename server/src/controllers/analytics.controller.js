import Order, { COUNTS_AS_SALE, REAL_ORDERS } from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

/**
 * Orders that count as real business. Cancelled and returned orders are
 * excluded from every revenue figure - counting them would inflate sales
 * with money that was never kept.
 */
const REVENUE_MATCH = COUNTS_AS_SALE;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * @route GET /api/analytics/overview
 * @access Admin
 *
 * An aggregation PIPELINE is a list of stages; documents flow through them
 * one stage at a time, like a Unix pipe. $match filters, $group collapses
 * many documents into summaries, $sum adds things up.
 *
 * Doing this in the database beats fetching every order into Node and looping:
 * MongoDB can use indexes, and only the small result crosses the network.
 */
export const overview = async (req, res) => {
  const [totals, customers, products, lowStock, recent] = await Promise.all([
    Order.aggregate([
      { $match: REVENUE_MATCH },
      {
        $group: {
          _id: null, // null = collapse EVERYTHING into one summary row
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$pricing.total' },
        },
      },
    ]),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
    Order.find(REAL_ORDERS).sort({ createdAt: -1 }).limit(5).populate('user', 'name email'),
  ]);

  // aggregate() returns an array; it is empty when there are no orders yet.
  const t = totals[0] || { revenue: 0, orders: 0, avgOrderValue: 0 };

  const pending = await Order.countDocuments({ status: { $in: ['placed', 'confirmed'] } });

  res.status(200).json({
    success: true,
    totals: {
      revenue: Math.round(t.revenue),
      orders: t.orders,
      avgOrderValue: Math.round(t.avgOrderValue || 0),
      customers,
      products,
      lowStock,
      pending,
    },
    recentOrders: recent,
  });
};

/**
 * @route GET /api/analytics/sales?days=30
 * @access Admin
 * Revenue and order count per day, for the sales graph.
 */
export const salesOverTime = async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  // Start at midnight India time, the same calendar the daily sales report uses.
  const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const since = new Date(new Date(`${todayIST}T00:00:00.000+05:30`).getTime() - (days - 1) * DAY_MS);

  const rows = await Order.aggregate([
    { $match: { ...REVENUE_MATCH, createdAt: { $gte: since } } },
    {
      $group: {
        // Group by calendar day. Without $dateToString every order would be
        // its own bucket, because timestamps differ by milliseconds.
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));

  res.status(200).json({
    success: true,
    days,
    // Every day appears, including days with no sales - a chart that skips
    // empty days draws a misleading straight line across them.
    series: Array.from({ length: days }, (_, i) => {
      const date = new Date(since.getTime() + i * DAY_MS + IST_OFFSET_MS).toISOString().slice(0, 10);
      const r = byDay.get(date);
      return { date, revenue: r ? Math.round(r.revenue) : 0, orders: r ? r.orders : 0 };
    }),
  });
};

/**
 * @route GET /api/analytics/top-products
 * @access Admin
 */
export const topProducts = async (req, res) => {
  const rows = await Order.aggregate([
    { $match: REVENUE_MATCH },
    // Each order holds an ARRAY of items. $unwind turns one order with three
    // items into three documents, so we can group by product.
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        brand: { $first: '$items.brand' },
        slug: { $first: '$items.slug' },
        units: { $sum: '$items.quantity' },
        // Revenue uses the SNAPSHOT price, not today's price - that is what
        // the customer actually paid.
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 8 },
  ]);

  res.status(200).json({ success: true, products: rows.map((r) => ({ ...r, revenue: Math.round(r.revenue) })) });
};

/**
 * @route GET /api/analytics/category-sales
 * @access Admin
 * $lookup is MongoDB's join: orders -> products -> categories.
 */
export const categorySales = async (req, res) => {
  const rows = await Order.aggregate([
    { $match: REVENUE_MATCH },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products', // the COLLECTION name (lowercase plural), not the model
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category.name',
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  res.status(200).json({
    success: true,
    categories: rows.map((r) => ({ name: r._id, revenue: Math.round(r.revenue), units: r.units })),
  });
};

/**
 * @route GET /api/analytics/customer-growth
 * @access Admin
 * New customers per month - free, because the User schema has timestamps.
 */
export const customerGrowth = async (req, res) => {
  const rows = await User.aggregate([
    { $match: { role: 'customer' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        customers: { $sum: 1 },
      },
    },
    // The LATEST 12 months: newest first, take 12, then put back in order.
    { $sort: { _id: -1 } },
    { $limit: 12 },
  ]);
  rows.reverse();

  // A running total reads better on a growth chart than isolated monthly bars.
  // It starts from everyone who joined before the first month shown.
  let running = rows.length
    ? await User.countDocuments({
      role: 'customer',
      createdAt: { $lt: new Date(`${rows[0]._id}-01T00:00:00.000+05:30`) },
    })
    : 0;
  const series = rows.map((r) => {
    running += r.customers;
    return { month: r._id, newCustomers: r.customers, total: running };
  });

  res.status(200).json({ success: true, series });
};

/**
 * @route GET /api/analytics/order-status
 * @access Admin
 */
export const orderStatusBreakdown = async (req, res) => {
  const rows = await Order.aggregate([
    { $match: REAL_ORDERS },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    statuses: rows.map((r) => ({ status: r._id, count: r.count })),
  });
};
