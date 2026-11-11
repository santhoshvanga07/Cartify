/**
 * One definition of a valid Indian delivery address, shared by checkout and
 * the saved-address book, so the two can never disagree.
 */
export const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];
const REQUIRED = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'];
const LIMITS = { fullName: 100, phone: 15, line1: 200, line2: 200, city: 100, state: 100, pincode: 6 };

/** @returns {string|null} a shopper-friendly problem, or null when the address is fine */
export const checkAddress = (a) => {
  // typeof first: a number or object here would crash .trim() with a 500.
  const missing = REQUIRED.filter((f) => typeof a?.[f] !== 'string' || !a[f].trim());
  if (missing.length) return `Missing address fields: ${missing.join(', ')}`;
  if (a.line2 != null && typeof a.line2 !== 'string') return 'Address line 2 must be text';
  const tooLong = ADDRESS_FIELDS.find((f) => typeof a[f] === 'string' && a[f].trim().length > LIMITS[f] + (f === 'phone' ? 5 : 0));
  if (tooLong) return `${tooLong} is too long`;
  if (!/^\d{6}$/.test(a.pincode.trim())) return 'Pincode must be 6 digits';
  if (!/^[6-9]\d{9}$/.test(a.phone.replace(/\s/g, ''))) return 'Enter a valid 10-digit mobile number';
  return null;
};

/** Only the address fields, trimmed; the phone without spaces. */
export const cleanAddress = (a) => ({
  fullName: a.fullName.trim(),
  phone: a.phone.replace(/\s/g, ''),
  line1: a.line1.trim(),
  line2: (a.line2 || '').trim(),
  city: a.city.trim(),
  state: a.state.trim(),
  pincode: a.pincode.trim(),
});

/** Same place, same person? Used to avoid saving the same address twice. */
export const sameAddress = (x, y) =>
  ['phone', 'line1', 'line2', 'city', 'pincode'].every(
    (f) => String(x[f] || '').toLowerCase().replace(/\s+/g, ' ') === String(y[f] || '').toLowerCase().replace(/\s+/g, ' ')
  );
