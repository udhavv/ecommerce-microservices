// import 'dotenv/config';

// const cleanStr = (val) => (val ? val.replace(/^["']|["']$/g, '').trim() : '');

// const nodeEnv = cleanStr(process.env.NODE_ENV) || 'development';
// console.log('this is the node env: ', nodeEnv)
// const isProduction = nodeEnv === 'production';

// const env = {
//   port: parseInt(cleanStr(process.env.PORT) || '4000', 10),
//   nodeEnv,
//   database: {
//     url: cleanStr(process.env.DATABASE_URL),
//   },
//   jwt: {
//     accessSecret: cleanStr(process.env.JWT_ACCESS_SECRET),
//     refreshSecret: cleanStr(process.env.JWT_REFRESH_SECRET),
//     accessExpiry: cleanStr(process.env.JWT_ACCESS_EXPIRY),
//     refreshExpiry: cleanStr(process.env.JWT_REFRESH_EXPIRY),
//   },
//   cors: {
//     origin: cleanStr(process.env.CORS_ORIGIN) || (isProduction ? cleanStr(process.env.PRODUCTION_FRONTEND_URL) : cleanStr(process.env.FRONTEND_URL_DEVELOPMENT)) || 'http://localhost:3000',
//   },
//   version: {
//     ver: cleanStr(process.env.VERSION) || '1.0.0',
//   },
//   smtp: {
//     host: cleanStr(process.env.HOST) || 'smtp.gmail.com',
//     port: parseInt(cleanStr(process.env.MAIL_PORT) || '587', 10),
//     user: cleanStr(process.env.SMTP_USER),
//     pass: cleanStr(process.env.SMTP_PASS),
//     from: cleanStr(process.env.MAIL_FROM) || cleanStr(process.env.SMTP_USER) || 'noreply@ecommerce.local',
//   },
//   app: {
//     frontendUrl: isProduction
//       ? cleanStr(process.env.PRODUCTION_FRONTEND_URL) || 'https://houseplant-frontend-qv6m.vercel.app'
//       : cleanStr(process.env.FRONTEND_URL_DEVELOPMENT) || 'http://localhost:3000',
//     backendUrl: cleanStr(process.env.BACKEND_URL) || `http://localhost:${cleanStr(process.env.PORT) || '4000'}`,
//   },
//   loki: {
//     url: cleanStr(process.env.GRAFANA_CLOUD_LOKI_URL),
//     user: cleanStr(process.env.GRAFANA_CLOUD_LOKI_USER),
//     token: cleanStr(process.env.GRAFANA_CLOUD_API_TOKEN) || cleanStr(process.env.GRAFANA_CLOUD_API_KEY),
//   },
// };

// export default env;











import 'dotenv/config';

const cleanStr = (value) => {
  if (typeof value !== 'string') return '';

  return value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();
};

const nodeEnv = cleanStr(process.env.NODE_ENV) || 'development';
const isProduction = nodeEnv === 'production';

const accessSecret = cleanStr(process.env.JWT_ACCESS_SECRET);
const refreshSecret = cleanStr(process.env.JWT_REFRESH_SECRET);

if (isProduction) {
  if (!accessSecret || !refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required in production.',
    );
  }

  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error(
      'Production JWT secrets must each contain at least 32 characters.',
    );
  }

  if (accessSecret === refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.',
    );
  }
}

const frontendUrl =
  cleanStr(
    isProduction
      ? process.env.PRODUCTION_FRONTEND_URL
      : process.env.FRONTEND_URL_DEVELOPMENT,
  ) || (isProduction
    ? ''
    : 'http://localhost:3000');

if (isProduction && !frontendUrl) {
  throw new Error('PRODUCTION_FRONTEND_URL is required in production.');
}

const env = {
  port: Number.parseInt(cleanStr(process.env.PORT) || '4000', 10),
  nodeEnv,

  database: {
    url: cleanStr(process.env.DATABASE_URL),
  },

  jwt: {
    accessSecret: accessSecret || 'dev-access-secret',
    refreshSecret: refreshSecret || 'dev-refresh-secret',
    accessExpiry: cleanStr(process.env.JWT_ACCESS_EXPIRY) || '15m',
    refreshExpiry: cleanStr(process.env.JWT_REFRESH_EXPIRY) || '7d',
  },

  cors: {
    origin: frontendUrl,
  },

  version: {
    ver: cleanStr(process.env.VERSION) || '1.0.0',
  },

  smtp: {
    host: cleanStr(process.env.HOST) || 'smtp.gmail.com',
    port: Number.parseInt(cleanStr(process.env.MAIL_PORT) || '587', 10),
    user: cleanStr(process.env.SMTP_USER),
    pass: cleanStr(process.env.SMTP_PASS),
    from:
      cleanStr(process.env.MAIL_FROM) ||
      cleanStr(process.env.SMTP_USER) ||
      'noreply@ecommerce.local',
  },

  app: {
    frontendUrl: frontendUrl.replace(/\/+$/, ''),
    backendUrl:
      cleanStr(process.env.BACKEND_URL) ||
      `http://localhost:${cleanStr(process.env.PORT) || '4000'}`,
  },

  loki: {
    url: cleanStr(process.env.GRAFANA_CLOUD_LOKI_URL),
    user: cleanStr(process.env.GRAFANA_CLOUD_LOKI_USER),
    token:
      cleanStr(process.env.GRAFANA_CLOUD_API_TOKEN) ||
      cleanStr(process.env.GRAFANA_CLOUD_API_KEY),
  },
};

export default env;
