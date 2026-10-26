import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';

export function getExpiryMs(expiryStr, fallbackMs = 15 * 60 * 1000) {
  if (!expiryStr) return fallbackMs;
  const match = expiryStr.toString().trim().match(/^(\d+)([dhms])$/);
  if (!match) return fallbackMs;

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const ms = {
    d: value * 24 * 60 * 60 * 1000,
    h: value * 60 * 60 * 1000,
    m: value * 60 * 1000,
    s: value * 1000,
  };

  return ms[unit] || fallbackMs;
}

export function generateAccessToken(payload) {
  // Ensure payload does not contain sensitive password hash or duplicate timestamps
  const cleanPayload = { ...payload };
  delete cleanPayload.password_hash;
  delete cleanPayload.password;
  delete cleanPayload.iat;
  delete cleanPayload.exp;

  return jwt.sign(cleanPayload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, {
    // 30 seconds clock tolerance to prevent false expiration from minor server clock drift
    clockTolerance: 30,
  });
}

export function getRefreshTokenExpiry() {
  const ms = getExpiryMs(env.jwt.refreshExpiry, 7 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + ms);
}
