import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

export const placeOrder = createAsyncThunk(
  'orders/place',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/orders', payload);
      return data.order;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

export const fetchMyOrders = createAsyncThunk('orders/mine', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders/my');
    return data.orders;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

export const fetchOrder = createAsyncThunk('orders/one', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/orders/${id}`);
    return data.order;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

export const cancelOrder = createAsyncThunk('orders/cancel', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/orders/${id}/cancel`);
    return data.order;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

const orderSlice = createSlice({
  name: 'orders',
  initialState: { list: [], current: null, placed: null, loading: false, error: null },
  reducers: {
    clearPlaced: (state) => {
      state.placed = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.placed = action.payload; // drives the confirmation screen
      })
      .addCase(fetchMyOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
        state.list = state.list.map((o) => (o._id === action.payload._id ? action.payload : o));
      })
      // One matcher pair instead of repeating pending/rejected four times.
      .addMatcher(
        (a) => a.type.startsWith('orders/') && a.type.endsWith('/pending'),
        (state) => {
          state.loading = true;
          state.error = null;
        }
      )
      .addMatcher(
        (a) => a.type.startsWith('orders/') && a.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
          state.error = action.payload;
        }
      );
  },
});

export const { clearPlaced } = orderSlice.actions;
export default orderSlice.reducer;
