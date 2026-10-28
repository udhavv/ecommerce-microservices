import {
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
  getCurrentUser,
  verifyUserEmail,
  forgotPassword as requestForgotPassword,
  resetPassword as handleResetPassword,
  AuthError,
} from '../services/auth.service.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { getExpiryMs } from '../utils/token.js';

const isProduction = env.nodeEnv === 'production';

const maskEmail = (email) => {
  if (typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : `${name}***`;
  return `${maskedName}@${domain}`;
};



const cookieBase = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    ...cookieBase,
    maxAge: getExpiryMs(
      env.jwt.accessExpiry,
      15 * 60 * 1000,
    ),
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieBase,
    maxAge: getExpiryMs(
      env.jwt.refreshExpiry,
      7 * 24 * 60 * 60 * 1000,
    ),
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', cookieBase);
  res.clearCookie('refreshToken', cookieBase);
};


const handleError = (error, req, res, next) => {
  if (error instanceof AuthError) {
    logger.warn(
      { statusCode: error.statusCode, reason: error.message, path: req.path, method: req.method },
      'Authentication request rejected',
    );
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  logger.error(
    { err: error.message, stack: error.stack, path: req.path, method: req.method },
    'Authentication server error',
  );

  return next(error);
};

export const register = async (req, res, next) => {
  try {
    logger.info({ email: maskEmail(req.body?.email) }, 'Processing user registration');
    const user = await registerUser(req.body);
    logger.info({ userId: user.id }, 'User registered successfully, verification email dispatched');

    return res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for the verification link.',
      data: { user },
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    logger.info({ method: req.method }, 'Processing email verification');
    const token = req.body?.token || req.query?.token;

    if (!token) {
      if (req.method === 'GET' && req.accepts('html')) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Verification Error</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 60px;">
            <h2 style="color: #dc2626;">Verification Failed</h2>
            <p style="color: #64748b;">Verification token is missing.</p>
          </body>
          </html>
        `);
      }

      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    const user = await verifyUserEmail(token);
    logger.info({ userId: user.id }, 'Email verification successful');

    // If accessed via a browser directly by clicking the link in the verification email
    if (req.method === 'GET' && req.accepts('html')) {
      const loginUrl = `${env.app.frontendUrl}/login?verified=true`;
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Verified Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); text-align: center; max-width: 440px; width: 90%; }
            .icon { font-size: 48px; color: #16a34a; margin-bottom: 16px; }
            h2 { color: #1e293b; margin-bottom: 12px; font-size: 22px; }
            p { color: #64748b; margin-bottom: 24px; line-height: 1.5; font-size: 15px; }
            .btn { background: #4f46e5; color: white !important; text-decoration: none; padding: 12px 26px; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">&#10004;</div>
            <h2>Email Verified!</h2>
            <p>Welcome, <strong>${user.displayName}</strong>. Your account has been verified and is now active. You can now log in to access your profile.</p>
            <a href="${loginUrl}" class="btn">Proceed to Login</a>
          </div>
        </body>
        </html>
      `);
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You may now log in.',
      data: { user },
    });
  } catch (error) {
    if (req.method === 'GET' && req.accepts('html')) {
      return res.status(error.statusCode || 400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Verification Error</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 60px;">
          <h2 style="color: #dc2626;">Verification Failed</h2>
          <p style="color: #64748b;">${error.message || 'Invalid or expired verification token.'}</p>
        </body>
        </html>
      `);
    }

    return handleError(error, req, res, next);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    logger.info({ email: maskEmail(req.body?.email) }, 'Processing forgot password request');
    const result = await requestForgotPassword(req.body.email);
    logger.info({ email: maskEmail(req.body?.email) }, 'Forgot password request processed');
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    logger.info('Processing password reset request');
    const result = await handleResetPassword(req.body);
    logger.info('Password reset completed successfully');
    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};

export const login = async (req, res, next) => {
  try {
    logger.info({ email: maskEmail(req.body?.email) }, 'Processing user login attempt');
    const { user, accessToken, refreshToken } = await loginUser(req.body);

    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: user.id }, 'User login successful');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user },
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};

export const refresh = async (req, res, next) => {
  try {
    logger.info('Processing session token refresh request');
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const { user, accessToken, refreshToken } = await refreshUserSession(token);

    setAuthCookies(res, accessToken, refreshToken);
    logger.info({ userId: user.id }, 'Session token refresh successful');

    return res.status(200).json({
      success: true,
      message: 'Session refreshed',
      data: { user },
    });
  } catch (error) {
    if (error instanceof AuthError && error.statusCode === 401) {
      clearAuthCookies(res);
    }

    return handleError(error, req, res, next);
  }
};

export const logout = async (req, res, next) => {
  try {
    logger.info('Processing user logout request');
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await logoutUser(token);
    clearAuthCookies(res);
    logger.info('User logout successful');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};

export const profile = async (req, res, next) => {
  try {
    logger.info({ userId: req.user?.id }, 'Retrieving user profile');
    const user = await getCurrentUser(req.user.id);

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    return handleError(error, req, res, next);
  }
};
