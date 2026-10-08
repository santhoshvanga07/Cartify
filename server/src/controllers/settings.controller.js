import Setting from '../models/Setting.js';
import ActivityLog from '../models/ActivityLog.js';
import { loadSettings, getSettings, publicSettings } from '../services/settings.service.js';
import { logActivity } from '../services/activity.service.js';
import { isRazorpayConfigured } from '../services/payment.service.js';

const EDITABLE = [
  'storeName', 'legalName', 'address', 'gstin', 'supportEmail',
  'gstRate', 'shippingFlat', 'freeShippingAbove', 'codEnabled', 'onlinePaymentEnabled', 'returnWindowDays',
];

/** @route GET /api/settings/public  @access Public */
export const getPublicSettings = (req, res) => {
  res.status(200).json({ success: true, settings: publicSettings() });
};

/** @route GET /api/settings  @access Super Admin */
export const getAllSettings = (req, res) => {
  res.status(200).json({
    success: true,
    settings: getSettings(),
    // Shown on the settings screen so "online payment" is not a mystery toggle.
    integrations: { razorpayKeys: isRazorpayConfigured() },
  });
};

/** @route PUT /api/settings  @access Super Admin */
export const updateSettings = async (req, res) => {
  const doc = await Setting.findOne({ key: 'platform' });
  const before = doc.toObject();

  for (const k of EDITABLE) if (req.body[k] !== undefined) doc[k] = req.body[k];

  if (!doc.codEnabled && !doc.onlinePaymentEnabled) {
    return res.status(400).json({ success: false, message: 'At least one payment method must stay enabled' });
  }

  doc.updatedBy = req.user._id;
  await doc.save();
  await loadSettings(); // take effect on this instance immediately

  const changed = EDITABLE.filter((k) => String(before[k]) !== String(doc[k]))
    .map((k) => `${k}: ${before[k]} -> ${doc[k]}`)
    .join('; ');
  if (changed) logActivity(req, 'settings.update', { type: 'settings', label: 'Platform settings' }, changed);

  res.status(200).json({ success: true, settings: getSettings() });
};

/**
 * @route GET /api/settings/activity?action=&actor=&page=
 * @access Super Admin
 * `action` matches a prefix, so "auth" returns every auth.* event.
 */
export const listActivity = async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 30;

  const filter = {};
  const action = String(req.query.action || '').replace(/[^a-z_.]/gi, '');
  if (action) filter.action = new RegExp(`^${action.replace('.', '\\.')}`);
  if (req.query.actor && /^[a-f0-9]{24}$/i.test(req.query.actor)) filter.actor = req.query.actor;

  const [total, logs] = await Promise.all([
    ActivityLog.countDocuments(filter),
    ActivityLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), logs });
};
