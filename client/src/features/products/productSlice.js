import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

/**
 * Strips empty values so we never send "?q=&category=" to the server.
 * The `filters` object here is the SAME shape the AI will produce in Week 9.
 */
const toParams = (filters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));

export const fetchProducts = createAsyncThunk(
  'products/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/products', { params: toParams(filters) });
      return data;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

export const fetchProduct = createAsyncThunk(
  'products/fetchOne',
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/products/${slug}`);
      return data.product;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

export const fetchCategories = createAsyncThunk(
  'products/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/categories');
      return data.categories;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    categories: [],
    current: null,
    total: 0,
    page: 1,
    pages: 0,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // list
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.products;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pages = action.payload.pages;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // single product
      .addCase(fetchProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.current = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      });
  },
});

export default productSlice.reducer;
