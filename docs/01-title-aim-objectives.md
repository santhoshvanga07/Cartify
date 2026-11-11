# 1. Project Title, Aim and Objectives

## Project title

**Cartify — An AI-Assisted E-Commerce Web Application**

| | |
|---|---|
| Course | Software Engineering Lab |
| Team | Team Cartify — M. Dheeraj, S. Pavan Teja, V. Chakradhar |
| Roll numbers | ____________ / ____________ / ____________ |
| Guide | ____________ |
| Duration | 3 September 2026 – 11 November 2026 (10 weeks) |
| Repository | github.com/dheerajcse9-tech/CARTIFY |

---

## Problem statement

Small Indian retailers who want to sell online face two problems:

1. **Building a trustworthy store is hard.** A real store must handle accounts, stock, payments, GST
   invoices, shipping, returns and refunds correctly. A store that oversells stock, loses a payment or lets a
   customer change a price in the browser loses money and customers.
2. **Shoppers struggle to find the right product.** Keyword search fails on everyday requests such as
   *"waterproof trekking shoes under ₹3,000"*. Comparing two products means opening both pages and reading
   every specification side by side.

## Aim

To design, build and test a **secure, full-stack e-commerce web application** in which customers can find,
compare, buy, pay for, track and return products, and store staff can run the whole business from a
dashboard. An **AI shopping assistant** turns plain-English requests into real catalogue searches, and
recommends and compares only products that actually exist and are in stock.

---

## Objectives

### General objectives

1. Apply the software-engineering life cycle (requirements → design → implementation → testing →
   deployment) to a real-world product, using an **Agile (Scrum)** process.
2. Build a **three-tier web application** (React front end, Node/Express REST API, MongoDB database) with a
   clean separation between presentation, business logic and data.
3. Make the system **secure by design**: every money and stock decision is made on the server, and every
   route checks who is calling.
4. Use **AI responsibly**: the language model only fills in a search filter. It never invents products,
   prices or specifications, and the store keeps working when the AI is unavailable.
5. **Verify** the system with automated API tests and end-to-end browser tests.

### Specific (measurable) objectives

| # | Objective | How it is met in Cartify | Proven by |
|---|---|---|---|
| O1 | Secure accounts with three roles (Customer, Admin, Super Admin) | JWT in an httpOnly cookie, bcrypt passwords, role check on every route, email confirmation, sign-in alerts, password reset, rate limits | `test:e2e`, `test:account` |
| O2 | A complete catalogue | Categories, products with specifications, up to 5 photos (Cloudinary), sizes/colours with their own stock | `test:fixes`, `test:variants`, `test:images` |
| O3 | Find products easily | Search, filters (category, price, rating, in stock), sorting, voice search | `test:fixes`, browser test |
| O4 | AI shopping assistant | Plain English → structured filter → real products; side-by-side AI comparison; keyword fallback when the AI is unavailable | `_aitest`, `test:fixes` |
| O5 | Correct checkout | Server-side prices, GST and shipping; coupons; saved addresses; stock reserved atomically, so it can never oversell | `_ordertest`, `test:wishlist-coupons` |
| O6 | Online payments | Razorpay with server-side signature verification, retry, automatic refunds, auto-cancel of unpaid orders | `test:payments` (43 checks) |
| O7 | Order life cycle | Placed → confirmed → shipped (courier + tracking) → delivered → return → refund; GST tax invoice | `test:shipping`, `test:payments` |
| O8 | Keep customers informed | Emails for welcome/confirmation, sign-in, order, payment, shipping, delivery, cancellation, return and refund | `test:account` |
| O9 | Community and trust | Reviews with verified-purchase badge, helpful votes, reporting; product Q&A; moderation queue | `_reviewtest`, `test:qa` |
| O10 | Run the business | Admin dashboard: orders, products, categories, customers, coupons, moderation, analytics, CSV reports, settings, activity log | `test:admin-tools`, `test:customers` |
| O11 | Recommendations | Similar products, frequently bought together, trending, picked for you, recently viewed | `test:reco` |
| O12 | Quality | 17 automated API test scripts (437 checks) + 51-step browser test, all passing | `docs/08-testing.md` |

---

## Scope

**In scope**
- Customer web store (desktop and mobile browsers), admin and super-admin dashboards.
- Payments in Indian rupees: cash on delivery and Razorpay (test mode).
- Email notifications over SMTP (e.g. Gmail).
- Deployment as two parts: web app (e.g. Vercel) and API (e.g. Render) with MongoDB Atlas.

**Out of scope (possible future work)**
- Native mobile apps; multiple sellers (marketplace).
- Live courier integration (tracking details are entered by staff).
- Razorpay webhooks (needs a public server); "notify me when back in stock".

## Expected outcome

A working, deployable store that a small retailer could run. Customers get a fast, honest shopping experience
with AI help; staff get one dashboard for everything; and an automated test suite shows that the critical
rules hold (prices, stock, payments, permissions).

---

### 30-second pitch (for the presentation)

> *Cartify is a full-stack e-commerce store built with React, Node and MongoDB. Customers can search in plain
> English, for example "trekking shoes under 3000", and our AI turns that into a real search over products we
> actually stock. They can compare products, pick sizes, pay online with Razorpay or cash on delivery, track
> the courier, and return items for a refund. Admins run everything from a dashboard with analytics and
> reports. Every price, stock and payment check happens on the server, and 437 automated checks plus a
> browser test prove it works.*
