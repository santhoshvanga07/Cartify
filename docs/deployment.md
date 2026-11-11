# Deploying Cartify — a beginner's guide

By the end of this guide Cartify will be live on the internet, at an address like
`https://cartify-yourname.vercel.app`, and anyone can open it on their phone or laptop.

It takes about **45–60 minutes** the first time. Everything here is **free**.

---

## Part 0 — Understand what we are doing (5 minutes of reading)

On your laptop, Cartify runs as **three pieces**:

| Piece | Folder | What it does | Where it will live online |
|---|---|---|---|
| **Database** | — | Stores users, products, orders | **MongoDB Atlas** |
| **API** (backend) | `server/` | Node + Express program: logins, prices, payments, emails | **Render** |
| **Web app** (frontend) | `client/` | The React pages people see in the browser | **Vercel** |

```
  Customer's browser
        │  opens the website
        ▼
  ┌──────────────┐   asks for data    ┌──────────────┐   reads/writes   ┌──────────────┐
  │ Vercel       │ ─────────────────▶ │ Render       │ ───────────────▶ │ MongoDB      │
  │ (web app)    │ ◀───────────────── │ (API)        │ ◀─────────────── │ Atlas (DB)   │
  └──────────────┘   JSON answers     └──────────────┘                  └──────────────┘
```

**Why three different websites?** Each is the best free option for its job:

- **Vercel** serves the web app's files very fast from servers around the world.
- **Render** runs the API *all the time*. Vercel only runs code for a few seconds per request, which would
  break things like the "release unpaid checkouts every 5 minutes" job in the API.
- **Atlas** is MongoDB's own hosting. On your laptop the API used a throw-away database that is wiped on
  every restart; online we need one that keeps the data.

**How do they find each other?** With **environment variables** — settings you type into each website's
dashboard (like the `.env` file on your laptop). For example, the web app is told "the API lives at
`https://cartify-api.onrender.com`". We will set these step by step.

**The order matters:** Database → API → Web app → connect them. Each step needs an address from the step
before.

### Before you start — checklist

- [ ] The code is on GitHub (`github.com/dheerajcse9-tech/CARTIFY`) and the latest version is pushed.
- [ ] A **GitHub account** (you have one). Sign up for Render and Vercel **with GitHub** — it lets them see
      your repository.
- [ ] A **Gmail account** for sending emails (sign-up codes, order emails). See Part 2, step 5.
- [ ] A notes file open (Notepad is fine). You will copy several passwords and addresses — paste each one
      there as you go. **Never** put these in the code or send them on WhatsApp groups.

---

## Part 1 — Database: MongoDB Atlas (≈10 minutes)

**Goal:** a free online database, and its *connection string* (one long line that tells the API where the
database is and how to log in).

1. Go to **mongodb.com/atlas** → **Try Free** → sign up (Google sign-in is fine).
2. **Create a cluster** (a "cluster" is just your database server):
   - Choose the **free** plan (called **M0** / *Free*).
   - Provider: AWS. Region: pick the one nearest to you, e.g. **Mumbai (ap-south-1)**.
   - Name: `Cartify` → **Create**. It takes 1–3 minutes.
3. **Create a database user** (the API logs in with this — it is *not* your Atlas login):
   - Atlas usually shows a "Security quickstart" right away. Otherwise go to **Database Access** →
     **Add New Database User**.
   - Username: `cartify_app`.
   - Password: click **Autogenerate Secure Password** and **copy it to your notes now**.
   - **Why autogenerate?** Characters like `@ # : /` in this password break the connection string. The
     generated one uses only letters and numbers. (If you choose your own, use only letters and digits.)
   - Role: **Read and write to any database** → **Add User**.
4. **Allow the API to connect** — **Network Access** → **Add IP Address** → **Allow access from anywhere**
   (it fills in `0.0.0.0/0`) → **Confirm**.
   - **Why "anywhere"?** Render's servers do not have one fixed address. The database is still protected by
     the username and password from step 3.
5. **Get the connection string** — **Database** → your cluster → **Connect** → **Drivers** (Node.js).
   Copy the string. It looks like:
   ```
   mongodb+srv://cartify_app:<db_password>@cartify.ab12cd.mongodb.net/?retryWrites=true&w=majority&appName=Cartify
   ```
6. **Edit it in your notes**, two changes:
   - Replace `<db_password>` (including the `< >`) with the password from step 3.
   - Add the database name **`cartify`** right after `.mongodb.net/`:
   ```
   mongodb+srv://cartify_app:Abc123xyz@cartify.ab12cd.mongodb.net/cartify?retryWrites=true&w=majority&appName=Cartify
   ```
   **Why the name?** Without it, MongoDB puts everything in a database called `test`.

✅ **Done when:** your notes contain one complete connection string starting with `mongodb+srv://` with your
real password in it.

---

## Part 2 — API: Render (≈15 minutes)

**Goal:** the `server/` folder running online, at an address like `https://cartify-api.onrender.com`.

### 2.1 Create the service

1. Go to **render.com** → **Get Started** → sign up **with GitHub**.
2. **New +** → **Web Service** → choose **Git Provider / GitHub** → pick **CARTIFY**.
   (If you don't see it: "Configure account" → give Render access to the repository.)
3. Fill in the settings:

   | Setting | Value | Why |
   |---|---|---|
   | Name | `cartify-api` | Becomes part of the address: `cartify-api.onrender.com` (Render may add letters if taken) |
   | Region | **Singapore** | Closest to India → faster |
   | Branch | `main` | Where our code is |
   | **Root Directory** | `server` | The repository has two apps; the API is in `server/` |
   | Runtime / Language | Node | |
   | Build Command | `npm install` | Downloads the libraries listed in `server/package.json` |
   | Start Command | `npm start` | Runs `node src/server.js` |
   | Instance Type | **Free** | |

### 2.2 Environment variables (the most important part)

On the same page find **Environment Variables** → **Add Environment Variable**, and add each row below.
Type the values **without quotes** (quotes are only needed in the `.env` file on your laptop).

**Required — the API will not work without these:**

| Key | Value | What it is |
|---|---|---|
| `NODE_ENV` | `production` | Turns on production behaviour: secure cookies, refuses a throw-away database |
| `MONGO_URI` | your connection string from Part 1 | Where the database is |
| `JWT_SECRET` | a long random text (see below) | The secret key that signs login tokens. Anyone who knows it could fake logins — keep it secret |
| `JWT_EXPIRES_IN` | `7d` | Logins last 7 days |
| `COOKIE_EXPIRES_DAYS` | `7` | Same, for the cookie |
| `SEED_SUPERADMIN_NAME` | `Super Admin` | |
| `SEED_SUPERADMIN_EMAIL` | your email, e.g. `yourname@gmail.com` | The **Super Admin** account is created with this on first start |
| `SEED_SUPERADMIN_PASSWORD` | a strong password, 8+ characters | Super Admin's password — write it in your notes |
| `SEED_ADMIN_NAME` | `Store Admin` | |
| `SEED_ADMIN_EMAIL` | another email you own (or a teammate's) | A normal **Admin** account |
| `SEED_ADMIN_PASSWORD` | another password | |
| `CLIENT_URL` | `http://localhost:5173` **for now** | The web app's address — we fix it in Part 4 |

To make a `JWT_SECRET`, run this in a terminal on your laptop and copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Email — strongly recommended:** sign-up sends a 6-digit code by email, and order emails need it too.

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | a Gmail **app password** — *not* your normal password (below) |
| `EMAIL_FROM` | `Cartify <your Gmail address>` |

How to get the Gmail app password: Google account → **Security** → turn on **2-Step Verification** → open
**myaccount.google.com/apppasswords** → create one named "Cartify" → copy the 16 letters (no spaces).
Gmail allows about 500 emails a day — plenty for a project.

> **No email set up?** Cartify still runs: each email (including the sign-up code) is printed in Render's
> **Logs** tab instead. Fine for testing alone, not for other people signing up.

**Optional — each feature switches itself on when its keys are present:**

| Feature | Keys | Where to get them |
|---|---|---|
| Product photos | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | cloudinary.com → Settings → API Keys |
| Online payment (test mode) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | razorpay.com → Test Mode → API Keys → Generate Test Key |
| AI assistant / compare | `GROQ_API_KEY` | console.groq.com → API Keys |

Do **not** add `PORT` — Render chooses the port itself and tells the app.

### 2.3 Deploy and check

1. Click **Create Web Service** (or **Deploy**). Watch the log: `npm install` … then
   `MongoDB connected: …` … `Super Admin created: …` … `Server running in production mode`.
   The first build takes 2–5 minutes.
2. At the top Render shows your address, e.g. `https://cartify-api.onrender.com`. **Copy it to your notes.**
3. Open `https://cartify-api.onrender.com/api/health` in your browser. You should see:
   ```json
   {"success":true,"message":"Cartify API is running", ...}
   ```

✅ **Done when:** the health page shows `"Cartify API is running"`.

> ⏰ **Free plan sleeps.** After ~15 minutes with no visitors Render pauses the API; the next visit takes
> 30–60 seconds while it wakes up. Before a demo, open the health page once and wait for it.

---

## Part 3 — Web app: Vercel (≈10 minutes)

**Goal:** the `client/` folder online at `https://<something>.vercel.app`.

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New…** → **Project** → find **CARTIFY** → **Import**.
3. Settings on the import page:

   | Setting | Value | Why |
   |---|---|---|
   | Project Name | e.g. `cartify-yourname` | Becomes the address `cartify-yourname.vercel.app` |
   | Framework Preset | **Vite** (detected automatically) | Vercel knows how to build Vite apps |
   | **Root Directory** | click **Edit** → choose `client` | The web app lives in `client/` |
   | Build Command / Output Directory | leave the defaults (`npm run build` / `dist`) | |

4. Open **Environment Variables** and add **one** variable:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render address from Part 2, e.g. `https://cartify-api.onrender.com` |

   - **Why?** This is how the web app knows where the API is. With or without `/api` at the end both work.
   - **Important:** Vercel bakes this value into the app *when it builds*. If you change it later you must
     **redeploy** (Part 6) for the change to take effect.
5. Click **Deploy**. After 1–2 minutes you get confetti and your address, e.g.
   `https://cartify-yourname.vercel.app`. **Copy it to your notes** — the main one, *not* the long ones with
   random letters (those are "preview" addresses).

✅ **Done when:** the site opens and shows the Cartify home page (it may say there are no products yet).

---

## Part 4 — Connect the two (2 minutes, don't skip!)

The API only accepts requests from the web app it trusts, and it puts the web app's address into emails
(order links, password-reset links). Tell it the real address:

1. Render → your `cartify-api` service → **Environment**.
2. Change `CLIENT_URL` to your Vercel address, **exactly**, with **no `/` at the end**:
   `https://cartify-yourname.vercel.app`
3. **Save Changes**. Render restarts the API automatically (about a minute).

**Why it matters:** if `CLIENT_URL` is wrong, signing in fails with a "CORS" error in the browser console.
CORS is the browser's rule that a website may only use an API that has said "I allow this website".

---

## Part 5 — Test the live site (10 minutes)

Use **Chrome or Edge in a normal window** (not Incognito, and not Safari — see the note below).

1. **Sign in as Super Admin** with `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`.
2. **Dashboard → Categories** — create a few (Laptops, Footwear…). **Others** is already there.
3. **Dashboard → Products** — add products with price, MRP, stock (and sizes for shoes). Add photos if you
   set up Cloudinary.
4. **Sign out**, then **Create account** as a customer with a real email you can open → enter the **6-digit
   code** from the email (or from Render **Logs** if email is not set up).
5. Add a product to the bag → **Checkout** → **Cash on delivery** → **Place order**. You should get an
   "Order placed" email.
6. Sign in as Super Admin again → **Dashboard → Orders** → **Mark confirmed → Mark shipped** (enter a
   courier and tracking number) → **Mark delivered**.
7. Open a link that has a path, e.g. `https://cartify-yourname.vercel.app/orders`, and press **refresh** —
   it should load, not show a 404. (`client/vercel.json` makes this work.)

**Why Chrome/Edge and not Incognito or Safari?** Your web app (`vercel.app`) and API (`onrender.com`) are on
two different websites, so the login cookie is a *third-party cookie*. Safari and Incognito windows block
those by default, so you would sign in and then immediately look signed out. Chrome and Edge in normal
windows allow it.

---

## Part 6 — Updating the live site later

You do **nothing special**: every `git push` to `main` makes **both** Render and Vercel rebuild and update
automatically within a few minutes.

```bash
git add -A
```
```bash
git commit -m "Describe your change"
```
```bash
git push origin main
```

- Changed an **environment variable on Render** → it restarts by itself after **Save Changes**.
- Changed `VITE_API_URL` **on Vercel** → go to **Deployments** → the newest one → **⋯** → **Redeploy**.

---

## When something goes wrong

First, look at the **logs**: Render → your service → **Logs** (API problems), or in the browser press
**F12 → Console** (web-app problems). The error message usually says what is wrong.

| What you see | Most likely cause | Fix |
|---|---|---|
| Opening the Render address shows `"Route not found: /"` (older versions) or "Cartify API is running. This is the backend" | Nothing is wrong - that is the API, not the website | Shop at your **Vercel** address; check the API at `/api/health` |
| Render log: `MONGO_URI is missing or invalid` / `MongoDB connection FAILED` | Connection string wrong, password still has `<db_password>`, or Network Access not set | Redo Part 1 steps 4–6; paste the corrected value into Render |
| Render log: `bad auth : authentication failed` | Wrong database password, or it contains special characters | Atlas → Database Access → Edit user → autogenerate a new password → update `MONGO_URI` |
| Render log: `JWT_SECRET is not set` | Variable missing | Add `JWT_SECRET` (Part 2.2) |
| Page says **"Network Error"**, or browser console says `blocked by CORS policy` | `CLIENT_URL` on Render does not match the Vercel address (Render's Logs show `CORS: refused a request from …` with the address to use) | Part 4: set `CLIENT_URL` to exactly what is in your browser's address bar, e.g. `https://team-cartifyy.vercel.app`. Several sites: separate them with commas |
| Site loads but shows no products / spins forever | `VITE_API_URL` wrong or missing, or the API is asleep | Open `/api/health` to wake it; fix `VITE_API_URL` and **Redeploy** on Vercel |
| Super Admin gets "Invalid credentials" | Typo in `SEED_SUPERADMIN_PASSWORD`, or the account was created earlier with a different password | The account is created only the first time. Use **Forgot password** on the sign-in page |
| Sign in works, then you look signed out again | Safari / Incognito blocking the cookie | Use Chrome or Edge in a normal window |
| No sign-up code / order emails arrive | SMTP not set or wrong app password | Check Render **Logs** for `Email to … failed: …`; recheck `SMTP_USER`/`SMTP_PASS`; look in spam. Meanwhile the code is printed in the Logs |
| "Pay online" is missing at checkout | Razorpay keys not set | Add `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` (test keys) |
| Product photos cannot be uploaded | Cloudinary keys not set | Add the three `CLOUDINARY_*` keys |
| First visit takes almost a minute | Render free plan was asleep | Normal. Open the site a minute before you need it |

---

## Keep it safe

- **Never** commit `.env` files or paste keys into the code. They belong only in the Render and Vercel
  dashboards (and your own `server/.env` on your laptop, which Git ignores).
- If a secret leaks (shared in a group chat, pushed to GitHub), **change it**: make a new `JWT_SECRET`
  (everyone is signed out — that is fine), a new Gmail app password, new Razorpay/Cloudinary keys.
- Keep Razorpay in **Test Mode** for the project — no real money moves.

---

## One-page summary

| # | Where | What you do | What you get |
|---|---|---|---|
| 1 | MongoDB Atlas | Free cluster, database user, allow `0.0.0.0/0`, copy connection string, add `/cartify` | `MONGO_URI` |
| 2 | Render | Web Service, root `server`, `npm install` / `npm start`, add environment variables | API address `https://….onrender.com` |
| 3 | Vercel | Import repo, root `client`, `VITE_API_URL` = API address | Site address `https://….vercel.app` |
| 4 | Render | Set `CLIENT_URL` = site address, save | The two can talk |
| 5 | Browser | Sign in as Super Admin, add categories and products, test a customer order | A working live store |
