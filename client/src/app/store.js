import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import productReducer from '../features/products/productSlice';
import cartReducer from '../features/cart/cartSlice';
import orderReducer from '../features/orders/orderSlice';
import aiReducer from '../features/ai/aiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,        // state.auth
    products: productReducer, // state.products
    cart: cartReducer,        // state.cart
    orders: orderReducer,     // state.orders
    ai: aiReducer,            // state.ai
    // cart, products, orders will slot in here later
  },
});
