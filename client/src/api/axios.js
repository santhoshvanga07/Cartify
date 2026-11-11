import axios from 'axios';

const apiRoot = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
const apiOrigin = apiRoot.replace(/\/+$/, '').replace(/\/api$/i, '');

// One configured axios instance for the whole app.
const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  withCredentials: true, // send/receive auth cookies (needed from Week 2)
});

export default api;
