# Cartify automated tests: JUnit 5 + Selenium

This folder is a small **Java + Maven** project that tests Cartify from the outside:

| Test class | Tool | What it does | Tests |
|---|---|---|---|
| `ApiTest.java` | **JUnit 5** | Sends HTTP requests to the REST API and checks the answers | 11 |
| `UiTest.java` | **Selenium WebDriver + JUnit 5** | Opens a real Chrome window and clicks through the website like a user | 8 |

- **JUnit** is the standard Java testing framework. You write methods marked `@Test`, and JUnit runs them
  and reports which passed or failed.
- **Selenium** controls a real web browser from code: open a page, type, click, and read what is on screen.

All 19 tests passed on 11 Nov 2026.

---

## Step 1: Install the tools (one time)

You need **3 things**: Java, Maven and Google Chrome.

### 1.1 Java (JDK 17 or newer)
1. Go to <https://adoptium.net> and download **Temurin JDK 21 (LTS)** for your system.
2. Run the installer. On Windows, tick **"Set JAVA_HOME"** and **"Add to PATH"**.
3. Open a **new** terminal (Command Prompt or PowerShell) and check:
   ```
   java -version
   ```
   It should print something like `openjdk version "21..."`.

### 1.2 Maven (builds the project and downloads JUnit and Selenium for you)
1. Go to <https://maven.apache.org/download.cgi> and download the **Binary zip archive**.
2. Unzip it, for example to `C:\maven`.
3. Add `C:\maven\bin` to your **PATH**: search Windows for *"Edit the system environment variables"* →
   **Environment Variables** → under *User variables* select **Path** → **Edit** → **New** → paste
   `C:\maven\bin` → OK.
4. Open a **new** terminal and check:
   ```
   mvn -v
   ```

> **Easier option:** install **IntelliJ IDEA Community** (free). It already contains Maven, so you can skip
> 1.2. See "Option B" in Step 3.

### 1.3 Google Chrome
Install the normal Google Chrome browser. You do **not** need to download ChromeDriver: Selenium 4
downloads the right driver for your Chrome automatically.

---

## Step 2: Start Cartify on your laptop

The tests need the website and the API running. Open **two** terminals in the project folder.

Terminal 1, the API:
```
cd server
npm install
npm run dev
```
Wait for `http://localhost:5000/api/health`.

Terminal 2, the website:
```
cd client
copy .env.example .env        (on Mac/Linux: cp .env.example .env)
npm install
npm run dev
```
Wait for `http://localhost:5173`.

---

## Step 3: Run the tests

Open a **third** terminal and go into this folder:
```
cd testing
```

### Option A: from the terminal

Run all tests (the first run downloads JUnit and Selenium, so it takes a minute):
```
mvn test
```

The 5 tests that need an admin are **skipped** unless you give an admin login. Use the Super Admin from
`server/.env` (`SEED_SUPERADMIN_EMAIL` and `SEED_SUPERADMIN_PASSWORD`):
```
mvn test "-Dadmin.email=superadmin@cartify.com" "-Dadmin.password=YOUR_PASSWORD"
```
Keep the quotes: they stop PowerShell from breaking passwords that contain `#` or `@`.

Run only one class:
```
mvn test -Dtest=ApiTest
mvn test -Dtest=UiTest
```

### Option B: from IntelliJ IDEA
1. **File → Open** → choose the `testing` folder → **Open as Project**. Wait while it loads Maven.
2. Open `src/test/java/com/cartify/tests/ApiTest.java`.
3. Click the green ▶ next to `class ApiTest` → **Run 'ApiTest'**.
4. To give the admin login: **Run → Edit Configurations…** → *VM options*:
   `-Dadmin.email=superadmin@cartify.com -Dadmin.password=YOUR_PASSWORD`

### What you will see
- A **Chrome window opens by itself** and clicks through the site (UiTest).
- At the end Maven prints, for example:
  `Tests run: 19, Failures: 0, Errors: 0, Skipped: 0` and **BUILD SUCCESS**.
- **Reports:** `target/surefire-reports/` (one `.txt` and one JUnit `.xml` file per class).
- **Screenshots** of every browser test: `target/screenshots/`.

### Useful options

| Option | Meaning | Default |
|---|---|---|
| `-Dweb.url=...` | Website address | `http://localhost:5173` |
| `-Dapi.url=...` | API address | `http://localhost:5000` |
| `-Dadmin.email=...` `-Dadmin.password=...` | Admin login for the admin tests | none (tests skipped) |
| `-Dheadless=true` | Run Chrome without a window (faster) | `false` |

To test the **deployed** site, point at it. Note that the admin tests then create test products there.
```
mvn test "-Dweb.url=https://YOUR-SITE.vercel.app" "-Dapi.url=https://YOUR-API.onrender.com"
```

---

## The test cases

The TC numbers match the test-case table in the SRS (Section 11.1).

**ApiTest (JUnit 5)**

| # | Test | Expected result |
|---|---|---|
| TC-53 | Health check | `GET /api/health` → 200 |
| TC-19 | Product list is public | `GET /api/products` → 200 with a list |
| TC-01 | Sign-up with an invalid email | 400 |
| TC-01 | Sign-up with a 3-character password | 400 |
| TC-03 | Login with a wrong password | 401 "Invalid credentials" |
| TC-24 | Bag without signing in | 401 |
| TC-40 | Orders / user list without signing in | 401 |
| TC-20 | AI search "shoes under 3000" | understood as `maxPrice = 3000` |
| TC-50 | Admin login *(admin)* | 200, role admin or superadmin |
| TC-11 | Price above MRP *(admin)* | 400 |
| TC-15, TC-19 | Create product → found by search → remove → no longer listed *(admin)* | as described |

**UiTest (Selenium + JUnit 5)**

| # | Test | Expected result |
|---|---|---|
| UI-01 | Open the home page | Tab title contains "Cartify" |
| UI-02 | Open the shop | Title "Shop · Cartify", search box visible |
| TC-19 | Type a product name in the search box *(admin)* | The product card appears |
| TC-03 | Sign in with a wrong password | Red message "Invalid credentials", stays on `/login` |
| TC-24 | Guest opens `/cart` | Sent to `/login` |
| TC-57 | Click "Returns & refunds" in the footer | Policy page with that heading |
| TC-50 | Admin signs in and opens `/admin` *(admin)* | "Recent orders" section visible |
| TC-61 | Shop page at phone width (390 px) | No sideways scrolling |

**A real bug these tests found:** TC-61 failed at first. On a phone, the signed-in menu bar was wider than
the screen, so the page scrolled sideways. The navbar was changed to wrap onto a second line on small
screens, and the test now passes.

---

## Troubleshooting

| Message | Fix |
|---|---|
| `'mvn' is not recognized` / `'java' is not recognized` | PATH not set, or the terminal was opened before installing. Open a new terminal; redo Step 1. |
| `Cannot reach the Cartify API at http://localhost:5000` | Start the API (Step 2, terminal 1). |
| `SessionNotCreatedException` / Chrome version error | Update Google Chrome, then run again. |
| `Tests run: 19, ... Skipped: 5` | Normal without an admin login: add `-Dadmin.email` and `-Dadmin.password`. |
| Login tests fail with 429 "Too many attempts" | The API's rate limit. Wait 15 minutes, or restart the API. |

---

## Key ideas for the viva

**JUnit 5**
- `@Test` marks a test method. `@DisplayName` gives it a readable name.
- `@BeforeAll` / `@AfterAll` run once (open and close the browser). `@AfterEach` runs after every test
  (takes the screenshot).
- `assertEquals(expected, actual)` and `assertTrue(condition)` decide pass or fail.
- `assumeTrue(...)` **skips** a test when something it needs (the admin login) is missing.
- `@Order` with `@TestMethodOrder` fixes the order the tests run in.

**Selenium WebDriver**
- `new ChromeDriver()` opens Chrome; `driver.get(url)` opens a page.
- **Locators** find elements: `By.id("shop-search")`, `By.name("email")`, `By.linkText(...)`, `By.xpath(...)`.
- `sendKeys(...)` types; `click()` clicks.
- **Explicit waits:** `WebDriverWait` + `ExpectedConditions` wait until something appears, instead of
  fixed sleeps. The React site loads data in the background, so this matters.

**Where these fit:** the 17 Node.js API scripts in `server/` are the main automated suite (479 checks,
white-box with the database). These JUnit and Selenium tests are black-box: they only use the public API
and the browser, the same way a user does.
