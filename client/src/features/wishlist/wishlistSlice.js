import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

/* Like the cart: every call returns the whole list, so the server stays the
   single source of truth for what is saved. */
const wishlistThunk = (name, fn) =>
  createAsyncThunk(`wishlist/${name}`, async (arg, { rejectWithValue }) => {
    try {
      const { data } = await fn(arg);
      return data.wishlist;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  });

export const fetchWishlist = wishlistThunk('fetch', () => api.get('/wishlist'));
export const addToWishlist = wishlistThunk('add', (productId) => api.post(`/wishlist/${productId}`));
export const removeFromWishlist = wishlistThunk('remove', (productId) =>
  api.delete(`/wishlist/${productId}`)
);
export const moveToCart = wishlistThunk('move', (productId) =>
  api.post(`/wishlist/${productId}/move-to-cart`)
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { products: [], loading: false, error: null },
  reducers: {
    resetWishlist: (state) => {
      state.products = [];
    },
  },
  extraReducers: (builder) => {
    [fetchWishlist, addToWishlist, removeFromWishlist, moveToCart].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.products = action.payload.products;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });
    });
  },
});

export const { resetWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
