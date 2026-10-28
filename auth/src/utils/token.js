// import jwt from 'jsonwebtoken';
// import crypto from 'crypto';
// import env from '../config/env.js';

// export function getExpiryMs(expiryStr, fallbackMs = 15 * 60 * 1000) {
//   if (!expiryStr) return fallbackMs;
//   const match = expiryStr.toString().trim().match(/^(\d+)([dhms])$/);
//   if (!match) return fallbackMs;

//   const value = parseInt(match[1], 10);
//   const unit = match[2];
//   const ms = {
//     d: value * 24 * 60 * 60 * 1000,
//     h: value * 60 * 60 * 1000,
//     m: value * 60 * 1000,
//     s: value * 1000,
//   };

//   return ms[unit] || fallbackMs;
// }

// export function generateAccessToken(payload) {
//   // Ensure payload does not contain sensitive password hash or duplicate timestamps
//   const cleanPayload = { ...payload };
//   delete cleanPayload.password_hash;
//   delete cleanPayload.password;
//   delete cleanPayload.iat;
//   delete cleanPayload.exp;

//   return jwt.sign(cleanPayload, env.jwt.accessSecret, {
//     expiresIn: env.jwt.accessExpiry,
//   });
// }

// export function generateRefreshToken() {
//   return crypto.randomBytes(40).toString('hex');
// }

// export function verifyAccessToken(token) {
//   return jwt.verify(token, env.jwt.accessSecret, {
//     // 30 seconds clock tolerance to prevent false expiration from minor server clock drift
//     clockTolerance: 30,
//   });
// }

// export function getRefreshTokenExpiry() {
//   const ms = getExpiryMs(env.jwt.refreshExpiry, 7 * 24 * 60 * 60 * 1000);
//   return new Date(Date.now() + ms);
// }










import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../config/env.js';

const JWT_ALGORITHM = 'HS256';

export function getExpiryMs(
  expiryStr,
  fallbackMs = 15 * 60 * 1000,
) {
  if (typeof expiryStr !== 'string') return fallbackMs;

  const match = expiryStr.trim().match(/^(\d+)([smhd])$/i);

  if (!match) return fallbackMs;

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const result = value * multipliers[unit];

  return Number.isSafeInteger(result) && result > 0
    ? result
    : fallbackMs;
}

export function generateAccessToken(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('A valid user payload is required.');
  }

  const cleanPayload = { ...payload };

  delete cleanPayload.password;
  delete cleanPayload.password_hash;
  delete cleanPayload.iat;
  delete cleanPayload.exp;
  delete cleanPayload.nbf;
  delete cleanPayload.jti;

  const userId = cleanPayload.sub ?? cleanPayload.id;

  if (userId === undefined || userId === null || String(userId).length === 0) {
    throw new Error('Cannot generate an access token without a user ID.');
  }

  // Use one canonical user identifier in the JWT subject claim.
  delete cleanPayload.id;
  cleanPayload.sub = String(userId);

  return jwt.sign(cleanPayload, env.jwt.accessSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwt.accessExpiry,
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new jwt.JsonWebTokenError('Access token is missing.');
  }

  return jwt.verify(token, env.jwt.accessSecret, {
    algorithms: [JWT_ALGORITHM],
    clockTolerance: 30,
  });
}

export function getRefreshTokenExpiry() {
  return new Date(
    Date.now() +
      getExpiryMs(env.jwt.refreshExpiry, 7 * 24 * 60 * 60 * 1000),
  );
}
