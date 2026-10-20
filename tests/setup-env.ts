/**
 * Runs before every test file (jest `setupFiles`), before src/config.ts loads
 * .env — dotenv never overrides a variable that's already set, so these win.
 *
 * Unit tests mock the SQS client, so these URLs are never called; the
 * LocalStack tests (npm run test:localstack) reach AWS_SQS_ENDPOINT for real.
 */
// AWS_REGION is deliberately left to .env / config's default: LocalStack
// creates the queues in that same region (docker-compose passes AWS_REGION
// through), and queue lookups are per region.
process.env.AWS_SQS_ENDPOINT = process.env.AWS_SQS_ENDPOINT || 'http://localhost:4566';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.PRODUCT_SYNC_QUEUE_URL = 'http://localhost:4566/000000000000/product-sync';
process.env.SUPPLIER_REFUND_QUEUE_URL = 'http://localhost:4566/000000000000/supplier-refund';
process.env.SQS_MAX_RECEIVE_COUNT = '3';
