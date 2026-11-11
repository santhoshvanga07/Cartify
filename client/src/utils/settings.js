import { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * The store's public settings (name, seller details, GST rate, return
 * window...). Fetched once per page load and shared by every component.
 * Until it arrives the hook returns the same defaults the server uses.
 */
const DEFAULTS = {
  storeName: 'Cartify',
  legalName: 'Cartify Retail Pvt. Ltd.',
  address: '',
  gstin: '',
  supportEmail: 'support@cartify.com',
  gstRate: 18,
  shippingFlat: 99,
  freeShippingAbove: 5000,
  codEnabled: true,
  returnWindowDays: 7,
};

let cache = null;
let pending = null;
// Every mounted useSettings(), so a saved change reaches components already on screen (e.g. the navbar).
const listeners = new Set();

const load = () => {
  pending ??= api
    .get('/settings/public')
    .then(({ data }) => (cache = { ...DEFAULTS, ...data.settings }))
    .catch(() => {
      pending = null; // try again next time
      return DEFAULTS;
    });
  return pending;
};

/** Call after the Super Admin saves, so this tab sees the change at once. */
export const invalidateSettings = () => {
  cache = null;
  pending = null;
  load().then((s) => listeners.forEach((notify) => notify(s)));
};

export const useSettings = () => {
  const [settings, setSettings] = useState(cache || DEFAULTS);

  useEffect(() => {
    let alive = true;
    load().then((s) => alive && setSettings(s));
    listeners.add(setSettings);
    return () => {
      alive = false;
      listeners.delete(setSettings);
    };
  }, []);

  return settings;
};
