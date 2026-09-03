import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import ensureSuperAdmin from './src/utils/ensureSuperAdmin.js';
import seedCatalog from './src/utils/seedCatalog.js';
import seedOrders from './src/utils/seedOrders.js';

await connectDB(); await ensureSuperAdmin(); await seedCatalog(); await seedOrders();
const server = app.listen(5099);
const base = 'http://localhost:5099';
let cookie = '';

const call = async (path, as = 'sa') => {
  const headers = cookie && as === 'sa' ? { Cookie: cookie } : {};
  const r = await fetch(base + path, { headers });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// log in as super admin
const lr = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.SEED_SUPERADMIN_EMAIL, password: process.env.SEED_SUPERADMIN_PASSWORD }),
});
cookie = (lr.headers.getSetCookie?.() ?? []).find(c => c.startsWith('token='))?.split(';')[0];

const inr = (n) => 'Rs ' + Number(n).toLocaleString('en-IN');

console.log('======== OVERVIEW ========');
let r = await call('/api/analytics/overview');
const t = r.body.totals;
console.log(`  revenue          ${inr(t.revenue)}`);
console.log(`  orders           ${t.orders}   (pending: ${t.pending})`);
console.log(`  avg order value  ${inr(t.avgOrderValue)}`);
console.log(`  customers        ${t.customers}`);
console.log(`  products         ${t.products}   (low stock: ${t.lowStock})`);

console.log('\n======== SALES (last 30 days) ========');
r = await call('/api/analytics/sales?days=30');
console.log(`  ${r.body.series.length} days with sales`);
r.body.series.slice(-5).forEach(d => console.log(`    ${d.date}  ${inr(d.revenue).padStart(14)}  ${d.orders} orders`));

console.log('\n======== TOP PRODUCTS ========');
r = await call('/api/analytics/top-products');
r.body.products.slice(0, 5).forEach(p => console.log(`    ${p.name.padEnd(26)} ${String(p.units).padStart(3)} units  ${inr(p.revenue)}`));

console.log('\n======== CATEGORY SALES ($lookup join) ========');
r = await call('/api/analytics/category-sales');
r.body.categories.forEach(c => console.log(`    ${c.name.padEnd(14)} ${inr(c.revenue).padStart(14)}  ${c.units} units`));

console.log('\n======== CUSTOMER GROWTH ========');
r = await call('/api/analytics/customer-growth');
r.body.series.forEach(m => console.log(`    ${m.month}  +${m.newCustomers}  (total ${m.total})`));

console.log('\n======== ORDER STATUS ========');
r = await call('/api/analytics/order-status');
r.body.statuses.forEach(s => console.log(`    ${s.status.padEnd(18)} ${s.count}`));

console.log('\n======== ACCESS CONTROL ========');
cookie = '';
r = await call('/api/analytics/overview', 'anon');
console.log(`  anonymous -> ${r.status} ${r.body.message}`);

server.close(); await mongoose.connection.close(); process.exit(0);
