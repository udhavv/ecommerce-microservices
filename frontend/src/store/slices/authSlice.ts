import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, LoginRequest, RegisterRequest } from '@/types/auth';
import { authService } from '@/services/auth.service';
import { getErrorMessage } from '@/lib/axios';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isLoading: false,
  isInitialLoading: true,
  isAuthenticated: false,
  error: null,
};

// Async thunk to verify session / fetch user profile on app load
export const checkAuth = createAsyncThunk<User, void, { rejectValue: string }>(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getProfile();
      if (response?.data?.user) {
        return response.data.user;
      }
      return rejectWithValue('User profile not found');
    } catch (error) {
      // If profile fetch fails (e.g. accessToken expired), attempt session refresh via httpOnly cookie
      try {
        const refreshResponse = await authService.refreshSession();
        if (refreshResponse?.data?.user) {
          return refreshResponse.data.user;
        }
      } catch {
        // Both profile and refresh failed; user is not authenticated
      }
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async thunk for logging in
export const loginUser = createAsyncThunk<User, LoginRequest, { rejectValue: string }>(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      console.log('this is the credentials: ', credentials)
      const response = await authService.login(credentials);
      if (response?.data?.user) {
        return response.data.user;
      }
      return rejectWithValue(response.message || 'Login failed');
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async thunk for registering
export const registerUser = createAsyncThunk<string, RegisterRequest, { rejectValue: string }>(
  'auth/registerUser',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authService.register(data);
      return (
        response.message ||
        'Account created successfully. Please check your email for the verification link.'
      );
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk<void, void>(
  'auth/logoutUser',
  async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
);

// Async thunk for manual token refresh
export const refreshUserSession = createAsyncThunk<User, void, { rejectValue: string }>(
  'auth/refreshSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.refreshSession();
      if (response?.data?.user) {
        return response.data.user;
      }
      return rejectWithValue('Failed to refresh session');
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

// Async thunk for upgrading account to seller
export const becomeSellerUser = createAsyncThunk<User, void, { rejectValue: string }>(
  'auth/becomeSeller',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.becomeSeller();
      if (response?.data?.user) {
        return response.data.user;
      }
      return rejectWithValue(response.message || 'Failed to upgrade to seller');
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    resetAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // checkAuth
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialLoading = false;
        state.user = null;
        state.isAuthenticated = false;
      });

    // loginUser
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
      });

    // registerUser
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Registration failed';
      });

    // logoutUser
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });

    // refreshUserSession
    builder
      .addCase(refreshUserSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      });

    // becomeSellerUser
    builder
      .addCase(becomeSellerUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      });
  },
});

export const { clearAuthError, setUser, resetAuth } = authSlice.actions;
export default authSlice.reducer;
