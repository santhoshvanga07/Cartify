import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

/* Every cart thunk returns the whole cart, so the client never has to guess
   what the server decided - totals and stock limits always come from there. */
const cartThunk = (name, fn) =>
  createAsyncThunk(`cart/${name}`, async (arg, { rejectWithValue }) => {
    try {
      const { data } = await fn(arg);
      return data.cart;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  });

export const fetchCart = cartThunk('fetch', () => api.get('/cart'));
export const addToCart = cartThunk('add', (payload) => api.post('/cart', payload));
// `variant` is the chosen size/colour ('' for products without options).
export const updateCartItem = cartThunk('update', ({ productId, variant = '', quantity }) =>
  api.patch(`/cart/${productId}`, { quantity }, { params: variant ? { variant } : {} })
);
export const removeCartItem = cartThunk('remove', ({ productId, variant = '' }) =>
  api.delete(`/cart/${productId}`, { params: variant ? { variant } : {} })
);
export const clearCart = cartThunk('clear', () => api.delete('/cart'));

const EMPTY_TOTALS = { subtotal: 0, discount: 0, gst: 0, shipping: 0, total: 0, itemCount: 0 };

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    totals: EMPTY_TOTALS,
    loading: false,
    error: null,
  },
  reducers: {
    // On logout, drop the cart from memory - the next user must not see it.
    resetCart: (state) => {
      state.items = [];
      state.totals = EMPTY_TOTALS;
    },
  },
  extraReducers: (builder) => {
    const thunks = [fetchCart, addToCart, updateCartItem, removeCartItem, clearCart];
    thunks.forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.items = action.payload.items;
          state.totals = action.payload.totals;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });
    });
  },
});

export const { resetCart } = cartSlice.actions;
export default cartSlice.reducer;
