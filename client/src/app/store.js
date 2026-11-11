import { configureStore } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import api from '../api/axios';
import authReducer, { sessionExpired } from '../features/auth/authSlice';
import productReducer from '../features/products/productSlice';
import cartReducer from '../features/cart/cartSlice';
import orderReducer from '../features/orders/orderSlice';
import aiReducer from '../features/ai/aiSlice';
import wishlistReducer from '../features/wishlist/wishlistSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,        // state.auth
    products: productReducer, // state.products
    cart: cartReducer,        // state.cart
    orders: orderReducer,     // state.orders
    ai: aiReducer,            // state.ai
    wishlist: wishlistReducer, // state.wishlist
  },
});

/**
 * A 401 from any signed-in request means the session is gone (expired, or
 * the password was changed on another device). Without this the navbar would
 * keep showing the user as signed in while every action quietly failed.
 *
 * /auth/* is skipped: a 401 there is an ordinary answer - a wrong password on
 * sign-in or on "change password", or "not signed in" from the start-up check.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/') && store.getState().auth.user) {
      store.dispatch(sessionExpired());
      toast.info('Your session has ended - please sign in again.', { toastId: 'session-expired' });
    }
    return Promise.reject(error);
  }
);
