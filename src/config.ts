import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3002;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isDev = NODE_ENV === 'development';
export const isTest = NODE_ENV === 'test';

/**
 * Reads a signing secret from the environment.
 *
 * Outside development/test a missing secret is fatal: falling back to a hardcoded
 * default would let anyone forge an admin token. In development and testing we fall back
 * loudly so test suites and local dev boot cleanly without a .env file.
 */
const requireSecret = (name: string, devFallback: string): string => {
  const value = process.env[name];
  if (value) return value;

  if (!isDev && !isTest) {
    throw new Error(`[config] ${name} must be set when NODE_ENV=${NODE_ENV}`);
  }

  // Logger isn't initialized this early — write directly.
  process.stderr.write(
    `[config] WARNING: ${name} is unset, using a fallback secret for ${NODE_ENV}\n`,
  );
  return devFallback;
};

export const ACCESS_TOKEN_SECRET = requireSecret('JWT_SECRET', 'dev-only-access-secret');
export const REFRESH_TOKEN_SECRET = requireSecret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret');
export const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRY || '1d';
export const REFRESH_TOKEN_EXPIRY = '7d';

export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Apex domain the verticals live under. `fashion.example.com` resolves to the
 * tenant with slug "fashion".
 */
export const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost';

/** Tenant used when a request carries no resolvable host (local dev, curl). */
export const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || '';

export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
export const REDIS_TTL_SECONDS = parseInt(process.env.REDIS_TTL_SECONDS || '3600');
export const REDIS_TLS = process.env.REDIS_TLS === 'true';
export const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '8080');

export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

// Accepts either naming: MAILER_* (used by this project's .env and
// docker-compose) or SMTP_* (used by most hosting providers).
export const SMTP_HOST =
  process.env.MAILER_TRANSPORT_HOST || process.env.SMTP_HOST || 'smtp.ethereal.email';
export const SMTP_PORT = parseInt(
  process.env.MAILER_TRANSPORT_PORT || process.env.SMTP_PORT || '587',
);
export const SMTP_USER = process.env.MAILER_EMAIL || process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.MAILER_PASSWORD || process.env.SMTP_PASS || '';

export const CJ_BASE_URL =
  process.env.CJ_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1';
export const CJ_API_KEY = process.env.CJ_API_KEY || '';
export const CJ_RATE_LIMIT_MS = parseInt(process.env.CJ_RATE_LIMIT_MS || '1500');
export const CJ_SUPPLIER_CACHE_TTL = parseInt(process.env.CJ_SUPPLIER_CACHE_TTL || '3600');

export const PRINTFUL_BASE_URL = process.env.PRINTFUL_BASE_URL || 'https://api.printful.com';
export const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY || '';
export const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID || '';
export const PRINTFUL_RATE_LIMIT_MS = parseInt(process.env.PRINTFUL_RATE_LIMIT_MS || '500');
