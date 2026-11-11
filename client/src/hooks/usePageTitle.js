import { useEffect } from 'react';
import { useSettings } from '../utils/settings';

/**
 * Sets the browser tab title: "Wildcraft Trek Shoes · Cartify".
 * Without it every tab, bookmark and search result just says "Cartify".
 * Pass nothing (or null while data loads) for the plain store name.
 */
const usePageTitle = (title) => {
  const { storeName } = useSettings();
  useEffect(() => {
    document.title = title ? `${title} · ${storeName}` : storeName;
  }, [title, storeName]);
};

export default usePageTitle;
