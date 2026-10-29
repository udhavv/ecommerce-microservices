export interface User {
  id: string;
  email: string;
  displayName: string;
  status: 'pending' | 'active' | 'suspended' | 'disabled';
  emailVerifiedAt: string | null;
  roles: string[];
  createdAt: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  details?: ValidationErrorDetail[];
  data?: T;
}

export interface AuthResponseData {
  user: User;
  accessToken?: string;
  refreshToken?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}
