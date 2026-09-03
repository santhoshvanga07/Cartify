import axios from 'axios';

// One configured axios instance for the whole app.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true, // send/receive auth cookies (needed from Week 2)
});

export default api;
