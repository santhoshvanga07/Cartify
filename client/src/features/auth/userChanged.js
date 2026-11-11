/**
 * Actions after which the data on screen may belong to someone else: a
 * sign-out, an expired session, or a (possibly different) person signing in.
 * Slices holding per-user data (orders, assistant chat) reset on these, so on
 * a shared computer the next person never sees the previous one's orders.
 *
 * Matched by type string so the slices do not have to import authSlice.
 */
const USER_CHANGED = new Set([
  'auth/logout/fulfilled',
  'auth/sessionExpired',
  'auth/login/fulfilled',
  'auth/register/fulfilled',
]);

export const isUserChange = (action) => USER_CHANGED.has(action.type);
