import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';

export function generateAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function getRefreshTokenExpiry() {
  const match = env.jwt.refreshExpiry.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const ms = {
    d: value * 24 * 60 * 60 * 1000,
    h: value * 60 * 60 * 1000,
    m: value * 60 * 1000,
    s: value * 1000,
  };

  return new Date(Date.now() + (ms[unit] || 7 * 24 * 60 * 60 * 1000));
}
