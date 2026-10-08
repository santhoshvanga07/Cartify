import Setting from '../models/Setting.js';

/**
 * In-memory copy of the platform settings.
 *
 * Pricing runs on every cart view, so reading settings must be synchronous
 * and free. The copy is refreshed at start-up, immediately after the Super
 * Admin saves, and at most once a minute otherwise - the last one covers a
 * second server instance picking up a change made on the first.
 */
const DEFAULTS = new Setting().toObject();
let cached = DEFAULTS;
let loadedAt = 0;
const TTL_MS = 60 * 1000;

export const getSettings = () => cached;

export const loadSettings = async () => {
  const doc = await Setting.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  cached = { ...DEFAULTS, ...doc };
  loadedAt = Date.now();
  return cached;
};

/** Express middleware: refresh the copy when it is older than a minute. */
export const refreshSettings = async (req, res, next) => {
  if (Date.now() - loadedAt > TTL_MS) {
    try {
      await loadSettings();
    } catch {
      // Keep serving the last good copy rather than failing the request.
    }
  }
  next();
};

/** The subset the storefront needs. Nothing admin-only. */
export const publicSettings = () => {
  const s = getSettings();
  return {
    storeName: s.storeName,
    legalName: s.legalName,
    address: s.address,
    gstin: s.gstin,
    supportEmail: s.supportEmail,
    gstRate: s.gstRate,
    shippingFlat: s.shippingFlat,
    freeShippingAbove: s.freeShippingAbove,
    codEnabled: s.codEnabled,
    returnWindowDays: s.returnWindowDays,
  };
};
