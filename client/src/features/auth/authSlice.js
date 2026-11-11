import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

/* Pulls a readable message out of an axios error. */
const msg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

/* ---------- Thunks: async actions ---------- */

export const registerUser = createAsyncThunk(
  'auth/register',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/register', credentials);
      return data.user;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      return data.user;
    } catch (err) {
      return rejectWithValue(msg(err));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
    return null;
  } catch (err) {
    return rejectWithValue(msg(err));
  }
});

/* Runs on app start: the cookie may still be valid from a previous visit. */
export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      return data.user;
    } catch {
      return rejectWithValue(null); // simply not logged in - not an error to display
    }
  }
);

/* ---------- Slice ---------- */

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,      // NOTE: no token here - it lives in an httpOnly cookie
    loading: false,
    error: null,
    initialised: false, // has the first /me check finished?
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    // For flows that return a fresh user outside the thunks above:
    // profile edits, password changes and password resets.
    setUser: (state, action) => {
      state.user = action.payload;
      state.initialised = true;
    },
    // The server answered 401: the cookie expired, or the password was changed
    // on another device. Treat the visitor as signed out.
    sessionExpired: (state) => {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // The three states, for every auth thunk
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.initialised = true;
      })
      .addCase(loadUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.initialised = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
      });

    // register and login behave identically, so wire them with one loop
    [registerUser, loginUser].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading = false;
          state.user = action.payload;
          state.initialised = true;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload;
        });
    });
  },
});

export const { clearError, setUser, sessionExpired } = authSlice.actions;
export default authSlice.reducer;
