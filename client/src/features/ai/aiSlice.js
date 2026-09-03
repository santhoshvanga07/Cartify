import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

export const aiSearch = createAsyncThunk('ai/search', async (query, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/ai/search', { query });
    return data;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

export const aiCompare = createAsyncThunk('ai/compare', async (slugs, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/ai/compare', slugs);
    return data;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

export const fetchAiStatus = createAsyncThunk('ai/status', async () => {
  const { data } = await api.get('/ai/status');
  return data;
});

const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    enabled: false,
    // A running transcript so the page reads as a conversation rather than
    // a search box that forgets what you just asked.
    turns: [],
    comparison: null,
    loading: false,
    error: null,
  },
  reducers: {
    resetChat: (state) => {
      state.turns = [];
      state.error = null;
    },
    clearComparison: (state) => {
      state.comparison = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAiStatus.fulfilled, (state, action) => {
        state.enabled = action.payload.enabled;
      })
      .addCase(aiSearch.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.turns.push({ role: 'user', text: action.meta.arg });
      })
      .addCase(aiSearch.fulfilled, (state, action) => {
        state.loading = false;
        state.turns.push({
          role: 'ai',
          text: action.payload.reply,
          interpretation: action.payload.interpretation,
          degraded: action.payload.degraded,
          widened: action.payload.widened,
          droppedKeyword: action.payload.droppedKeyword,
          products: action.payload.products,
          total: action.payload.total,
        });
      })
      .addCase(aiSearch.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.turns.push({ role: 'ai', text: action.payload, failed: true });
      })
      .addCase(aiCompare.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.comparison = null;
      })
      .addCase(aiCompare.fulfilled, (state, action) => {
        state.loading = false;
        state.comparison = action.payload;
      })
      .addCase(aiCompare.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { resetChat, clearComparison } = aiSlice.actions;
export default aiSlice.reducer;
