# Cartify

Full-stack, AI-assisted e-commerce web application — Software Engineering Lab project by **Team Cartify**
(M. Dheeraj, S. Pavan Teja, V. Chakradhar).

MERN stack: React 19 + Vite + Tailwind + Redux Toolkit on the front, Node + Express 5 + MongoDB (Mongoose) on
the back. Groq LLM for AI features, Razorpay for payments, Cloudinary for images, Nodemailer for email.

## Run it locally

```bash
# API
cd server
cp .env.example .env        # fill in JWT_SECRET and SEED_SUPERADMIN_PASSWORD at minimum
npm install
npm run dev                 # http://localhost:5000/api/health

# Web app (second terminal)
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Leave `MONGO_URI` blank and the API starts a throwaway in-memory MongoDB, seeded with the catalogue, sample
customers and orders, reviews, and the coupons `WELCOME10` and `FLAT500`.

Every integration is optional and stays switched off until its keys are set:

| Integration | Keys | Without them |
|---|---|---|
| Groq (AI search, compare) | `GROQ_API_KEY` | AI search falls back to keyword search |
| Razorpay (online payment) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Only cash on delivery is offered |
| Cloudinary (product images) | `CLOUDINARY_*` | Generated placeholder artwork |
| SMTP email | `SMTP_USER`, `SMTP_PASS` | Emails (including reset links) are printed to the server console |

## Accounts

| Role | Signs in with | Can |
|---|---|---|
| Customer | anyone who registers | shop, wishlist, order, pay, track, return, review, ask/answer questions |
| Admin | `SEED_ADMIN_*` from `.env` | products, categories, orders, coupons, customers, moderation, reports |
| Super Admin | `SEED_SUPERADMIN_*` from `.env` | everything above, plus admins and roles, platform settings, activity log |

## The 26 modules

| # | Module | Where |
|---|---|---|
| 01 | Authentication | JWT in an httpOnly cookie, register/login/logout, forgot & reset password (hashed single-use tokens), change password signs out other devices |
| 02 | Customer | Profile: edit name, change password |
| 03 | Product | CRUD, soft delete, Cloudinary images, per-category specifications |
| 04 | Category | CRUD; refuses to delete a category still in use |
| 05 | Search | Keyword search over a curated search index |
| 06 | Filter & Sorting | Category, price, rating, stock; newest / price / rating |
| 07 | Cart | Server-priced, stock-checked |
| 08 | Wishlist | Save, move to bag, count in the navbar |
| 09 | Checkout | Address validation, coupons, GST and shipping computed on the server |
| 10 | Payment | Cash on delivery; Razorpay with server-side signature verification, retry and refunds |
| 11 | Orders | Tracking, cancel, return requests within the return window, GST tax invoice (print / PDF) |
| 12 | Review & Rating | Verified-purchase badge, helpful votes, reporting |
| 13 | AI Shopping Assistant | Chat that turns plain English into a real catalogue search |
| 14 | AI Product Comparison | Pros, cons and best value from the products' real specs |
| 15 | AI Search by Description | "Waterproof trekking shoes under 5k" → filters → products |
| 16 | Recommendation System | Similar products, frequently bought together, trending, picked for you, recently viewed |
| 17 | Community | Product Q&A: ask, answer, upvote, mark helpful, report; staff and verified-buyer badges |
| 18 | Notifications | Order, payment, shipping, refund and password emails; staff alerts; in-app toasts |
| 19 | Customer Dashboard | Orders, spend, wishlist and recent orders at a glance |
| 20 | Admin Dashboard | Overview, orders, products, categories, customers, coupons, moderation, reports |
| 21 | Super Admin Dashboard | Users & admins, roles, platform settings, activity log |
| 22 | Analytics | Revenue, sales over time, top products, category sales, customer growth |
| 23 | Security | bcrypt, RBAC on every route, rate limits, Helmet, CORS, input validation, audit log |
| 24 | Settings | Store/invoice details, GST rate, shipping fee and threshold, payment methods, return window |
| 25 | Reports | Daily sales, orders and product performance — on screen and as CSV |
| 26 | Miscellaneous | Voice search (Web Speech API), printable invoices, recently viewed |

## Tests

Each `server/_*test.mjs` script boots the API against a fresh in-memory database and checks behaviour end to
end over HTTP:

```bash
cd server
npm run test:e2e            # auth and RBAC
npm run test:wishlist-coupons
npm run test:payments       # Razorpay is stubbed in-process
npm run test:account        # profile, passwords, emails
npm run test:qa
npm run test:customers
npm run test:admin-tools    # settings, activity log, reports
npm run test:reco
node _ordertest.mjs && node _carttest.mjs && node _reviewtest.mjs
```

If your network blocks MongoDB's binary download, point the in-memory server at a local `mongod`:
`MONGOMS_SYSTEM_BINARY=/path/to/mongod`.

The web app: `cd client && npm run lint && npm run build`.
