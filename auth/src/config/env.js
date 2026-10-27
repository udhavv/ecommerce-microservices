import 'dotenv/config';

const cleanStr = (val) => (val ? val.replace(/^["']|["']$/g, '').trim() : '');

const nodeEnv = cleanStr(process.env.NODE_ENV) || 'development';
const isProduction = nodeEnv === 'production';

const env = {
  port: parseInt(cleanStr(process.env.PORT) || '4000', 10),
  nodeEnv,
  database: {
    url: cleanStr(process.env.DATABASE_URL),
  },
  jwt: {
    accessSecret: cleanStr(process.env.JWT_ACCESS_SECRET) || 'dev-access-secret',
    refreshSecret: cleanStr(process.env.JWT_REFRESH_SECRET) || 'dev-refresh-secret',
    accessExpiry: cleanStr(process.env.JWT_ACCESS_EXPIRY) || '15m',
    refreshExpiry: cleanStr(process.env.JWT_REFRESH_EXPIRY) || '7d',
  },
  cors: {
    origin: cleanStr(process.env.CORS_ORIGIN) || (isProduction ? cleanStr(process.env.PRODUCTION_FRONTEND_URL) : cleanStr(process.env.FRONTEND_URL_DEVELOPMENT)) || 'http://localhost:3000',
  },
  version: {
    ver: cleanStr(process.env.VERSION) || '1.0.0',
  },
  smtp: {
    host: cleanStr(process.env.HOST) || 'smtp.gmail.com',
    port: parseInt(cleanStr(process.env.MAIL_PORT) || '587', 10),
    user: cleanStr(process.env.SMTP_USER),
    pass: cleanStr(process.env.SMTP_PASS),
    from: cleanStr(process.env.MAIL_FROM) || cleanStr(process.env.SMTP_USER) || 'noreply@ecommerce.local',
  },
  app: {
    frontendUrl: isProduction
      ? cleanStr(process.env.PRODUCTION_FRONTEND_URL) || 'https://houseplant-frontend-qv6m.vercel.app'
      : cleanStr(process.env.FRONTEND_URL_DEVELOPMENT) || 'http://localhost:3000',
    backendUrl: cleanStr(process.env.BACKEND_URL) || `http://localhost:${cleanStr(process.env.PORT) || '4000'}`,
  },
  loki: {
    url: cleanStr(process.env.GRAFANA_CLOUD_LOKI_URL),
    user: cleanStr(process.env.GRAFANA_CLOUD_LOKI_USER),
    token: cleanStr(process.env.GRAFANA_CLOUD_API_TOKEN) || cleanStr(process.env.GRAFANA_CLOUD_API_KEY),
  },
};

export default env;
