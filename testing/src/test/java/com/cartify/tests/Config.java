package com.cartify.tests;

/**
 * Where the tests point and which account they use.
 *
 * Every value can be changed without editing code, either as a Maven option
 * (mvn test -Dweb.url=https://my-site.vercel.app) or as an environment variable (WEB_URL=...).
 * The defaults match the app running on your own laptop.
 */
public final class Config {

    private Config() {}

    /** The website (React app). Locally: npm run dev inside client/. */
    public static final String WEB_URL = trimSlash(read("web.url", "WEB_URL", "http://localhost:5173"));

    /** The REST API (Node + Express). Locally: npm run dev inside server/. */
    public static final String API_URL = trimSlash(read("api.url", "API_URL", "http://localhost:5000"));

    /** An Admin or Super Admin login. Tests that need it are skipped when it is not given. */
    public static final String ADMIN_EMAIL = read("admin.email", "ADMIN_EMAIL", "");
    public static final String ADMIN_PASSWORD = read("admin.password", "ADMIN_PASSWORD", "");

    /** true = run Chrome without a window (faster); false = watch the browser click through the site. */
    public static final boolean HEADLESS = Boolean.parseBoolean(read("headless", "HEADLESS", "false"));

    /** Optional: path to a Chrome/Chromium program, only needed if Chrome is not installed normally. */
    public static final String CHROME_BINARY = read("chrome.binary", "CHROME_BINARY", "");

    public static boolean hasAdminLogin() {
        return !ADMIN_EMAIL.isBlank() && !ADMIN_PASSWORD.isBlank();
    }

    private static String read(String property, String envVar, String fallback) {
        String value = System.getProperty(property);
        if (value == null || value.isBlank()) value = System.getenv(envVar);
        return (value == null || value.isBlank()) ? fallback : value.trim();
    }

    private static String trimSlash(String url) {
        return url.replaceAll("/+$", "");
    }
}
