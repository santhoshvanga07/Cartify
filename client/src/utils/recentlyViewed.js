/**
 * "Recently viewed" lives in the browser: it is a convenience for this
 * device, not account data, and guests get it too. Only slugs are kept -
 * prices and stock are fetched fresh when the shelf is shown.
 *
 * Storage can be unavailable (private mode, blocked cookies), so every
 * access is wrapped and failure just means an empty list.
 */
const KEY = 'cartify:recently-viewed';
const MAX = 8;

export const getRecentlyViewed = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

export const recordView = (slug) => {
  try {
    const list = [slug, ...getRecentlyViewed().filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked - nothing to remember */
  }
};
