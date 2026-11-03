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

const frontendUrl =
  cleanStr(
    isProduction
      ? process.env.PRODUCTION_FRONTEND_URL
      : process.env.FRONTEND_URL_DEVELOPMENT
  ) || 'http://localhost:3000';

const env = {
  port: Number.parseInt(cleanStr(process.env.PORT) || '4003', 10),
  nodeEnv,
  isProduction,

  database: {
    url: cleanStr(process.env.DATABASE_URL),
    host: cleanStr(process.env.DB_HOST) || 'localhost',
    port: Number.parseInt(cleanStr(process.env.DB_PORT) || '5432', 10),
    user: cleanStr(process.env.DB_USER) || 'postgres',
    password: cleanStr(process.env.DB_PASSWORD) || '',
    database: cleanStr(process.env.DB_NAME) || 'orders',
  },

  cors: {
    origin: frontendUrl,
  },

  version: {
    ver: cleanStr(process.env.VERSION) || '1.0.0',
  },

  jwt: {
    accessSecret:
      cleanStr(process.env.JWT_ACCESS_SECRET) ||
      'thisisthesupersecretthisisthesupersecretthisisthesupersecretthisisthesupersecret',
  },

  services: {
    productUrl: cleanStr(process.env.PRODUCT_SERVICE_URL) || 'http://localhost:4001/api',
    inventoryUrl: cleanStr(process.env.INVENTORY_SERVICE_URL) || 'http://localhost:4002/api',
  },

  rabbitmq: {
    url: cleanStr(process.env.RABBITMQ_URL) || 'amqp://guest:guest@localhost:5672',
    exchange: cleanStr(process.env.RABBITMQ_EXCHANGE) || 'ecommerce_events',
    orderQueue: cleanStr(process.env.RABBITMQ_ORDER_QUEUE) || 'order_service_queue',
    prefetch: Number.parseInt(cleanStr(process.env.RABBITMQ_PREFETCH) || '10', 10),
  },

  logLevel: cleanStr(process.env.LOG_LEVEL) || 'info',

  loki: {
    url: cleanStr(process.env.GRAFANA_CLOUD_LOKI_URL),
    user: cleanStr(process.env.GRAFANA_CLOUD_LOKI_USER),
    token: cleanStr(process.env.GRAFANA_CLOUD_API_TOKEN),
  },
};

export default env;
