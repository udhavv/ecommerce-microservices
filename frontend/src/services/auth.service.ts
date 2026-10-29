import authApiClient from '@/lib/axios';
import {
  ApiResponse,
  AuthResponseData,
  RegisterRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  User,
} from '@/types/auth';

export const authService = {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponseData>> {
    const response = await authApiClient.post<ApiResponse<AuthResponseData>>(
      '/register',
      data
    );
    return response.data;
  },

  /**
   * Login user with email & password
   */
  async login(data: LoginRequest): Promise<ApiResponse<AuthResponseData>> {
    const response = await authApiClient.post<ApiResponse<AuthResponseData>>(
      '/login',
      data
    );
    return response.data;
  },

  /**
   * Logout user and clear cookies
   */
  async logout(): Promise<ApiResponse<void>> {
    const response = await authApiClient.post<ApiResponse<void>>('/logout');
    return response.data;
  },

  /**
   * Fetch current authenticated user's profile
   */
  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    const response = await authApiClient.get<ApiResponse<{ user: User }>>('/profile');
    return response.data;
  },

  /**
   * Manually trigger session refresh
   */
  async refreshSession(): Promise<ApiResponse<AuthResponseData>> {
    const response = await authApiClient.post<ApiResponse<AuthResponseData>>(
      '/refresh'
    );
    return response.data;
  },

  /**
   * Request password reset link
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<void>> {
    const response = await authApiClient.post<ApiResponse<void>>(
      '/forgot-password',
      data
    );
    return response.data;
  },

  /**
   * Reset password with verification token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<void>> {
    const response = await authApiClient.post<ApiResponse<void>>(
      '/reset-password',
      data
    );
    return response.data;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(data: VerifyEmailRequest): Promise<ApiResponse<{ user: User }>> {
    const response = await authApiClient.post<ApiResponse<{ user: User }>>(
      '/verify-email',
      data
    );
    return response.data;
  },

  /**
   * Upgrade user to seller role
   */
  async becomeSeller(): Promise<ApiResponse<AuthResponseData>> {
    const response = await authApiClient.post<ApiResponse<AuthResponseData>>(
      '/become-seller'
    );
    console.log('this is the become seller: ', response)
    return response.data;
  },
};

export default authService;
