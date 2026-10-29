'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  loginUser,
  registerUser,
  logoutUser,
  checkAuth,
  clearAuthError,
  refreshUserSession,
  becomeSellerUser,
} from '@/store/slices/authSlice';
import { LoginRequest, RegisterRequest } from '@/types/auth';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, isLoading, isInitialLoading, isAuthenticated, error } =
    useAppSelector((state) => state.auth);

  const login = async (credentials: LoginRequest) => {
    const resultAction = await dispatch(loginUser(credentials));
    if (loginUser.fulfilled.match(resultAction)) {
      return resultAction.payload;
    }
    throw new Error(resultAction.payload || 'Login failed');
  };

  const register = async (data: RegisterRequest) => {
    const resultAction = await dispatch(registerUser(data));
    if (registerUser.fulfilled.match(resultAction)) {
      return resultAction.payload;
    }
    throw new Error(resultAction.payload || 'Registration failed');
  };

  const logout = async () => {
    await dispatch(logoutUser());
  };

  const verifySession = async () => {
    await dispatch(checkAuth());
  };

  const refreshSession = async () => {
    const resultAction = await dispatch(refreshUserSession());
    if (refreshUserSession.fulfilled.match(resultAction)) {
      return resultAction.payload;
    }
    throw new Error(resultAction.payload || 'Refresh failed');
  };

  const becomeSeller = async () => {
    const resultAction = await dispatch(becomeSellerUser());
    if (becomeSellerUser.fulfilled.match(resultAction)) {
      return resultAction.payload;
    }
    throw new Error(resultAction.payload || 'Failed to upgrade to seller');
  };

  const clearError = () => {
    dispatch(clearAuthError());
  };

  return {
    user,
    isLoading,
    isInitialLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    checkAuth: verifySession,
    refreshSession,
    becomeSeller,
    clearError,
  };
}

export default useAuth;
