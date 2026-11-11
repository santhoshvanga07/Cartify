/**
 * The website(s) allowed to use this API, from CLIENT_URL.
 *
 * Forgiving on purpose, because a tiny mismatch here breaks every request
 * with a "Network Error" in the browser:
 *  - a trailing slash is ignored ("https://x.vercel.app/" = "https://x.vercel.app");
 *  - several sites can be listed, separated by commas
 *    ("https://team-cartifyy.vercel.app,http://localhost:5173").
 * The FIRST one is the main site, used for links in emails.
 */
const normalise = (url) => url.trim().replace(/\/+$/, '');

export const allowedOrigins = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(normalise).filter(Boolean);

/** The main website address - for links in emails (order pages, password reset). */
export const clientUrl = () => allowedOrigins()[0];

const warned = new Set();

/** For the cors() middleware: allow listed sites, and say clearly in the logs which one was refused. */
export const checkOrigin = (origin, callback) => {
  // No Origin header: not a browser on another site (health checks, curl, same-site requests).
  if (!origin) return callback(null, true);
  const allowed = allowedOrigins();
  if (allowed.includes(normalise(origin))) return callback(null, true);
  if (!warned.has(origin)) {
    warned.add(origin);
    console.warn(
      `CORS: refused a request from ${origin}. If that is your website, set CLIENT_URL to it ` +
      `(now CLIENT_URL = ${allowed.join(', ')}).`
    );
  }
  return callback(null, false); // no CORS headers -> the browser blocks it
};
