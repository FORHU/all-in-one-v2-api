import dotenv from 'dotenv';
dotenv.config();

import os from 'os';
import http from 'http';
import { redis } from './infrastructure/redis';
import type { Consumer } from './infrastructure/sqs';
import { startProductSyncConsumer } from './consumers/product-sync.consumer';
import { startSupplierRefundConsumer } from './consumers/supplier-refund.consumer';
import { workerMetrics } from './utils/worker-metrics';
import { startScheduler, stopScheduler } from './infrastructure/scheduler';
import { registerSuppliers } from './suppliers';
import { prisma } from './utils/prisma';
import logger from './utils/logger';

const WORKER_HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT || 8080);
const cpuCount = os.cpus().length;

// Track readiness state — 503 until all consumers are up
let isReady = false;

let consumers: Consumer[] = [];

/**
 * Lightweight health HTTP server — runs on a separate port from the API.
 * Kubernetes/ECS probes this independently to manage worker lifecycle.
 *
 * GET /health → 503 while starting, 200 with metrics snapshot when ready
 * GET /live   → always 200 (process is alive)
 */
const healthServer = http.createServer((req, res) => {
  if (req.url === '/live') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: Math.floor(process.uptime()) }));
    return;
  }

  if (req.url === '/health' || req.url === '/ready') {
    if (isReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(workerMetrics.getSnapshot()));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'starting' }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const startWorker = async () => {
  logger.info(
    `[Worker] Starting on ${os.hostname()} (${cpuCount} CPUs, ${Math.round(os.totalmem() / 1024 / 1024)}MB RAM)`,
  );

  if (cpuCount <= 1) {
    logger.warn(`[Worker] Only ${cpuCount} CPU core(s) available — consider scaling.`);
  }

  // Redis backs worker metrics and the scheduler's lock. SQS needs no
  // connection — it's plain HTTPS per call.
  await redis.connect();

  // Populate supplierRegistry (CJ/AliExpress/Printful adapters) — the
  // product-sync consumer below calls supplierRegistry.get(...) per job, so
  // this has to happen before consumers start receiving messages, same as
  // server.ts's setup() does for the API process.
  registerSuppliers();

  // Start polling. Throws (failing startup) if a queue URL isn't configured —
  // a worker with nothing to consume shouldn't report healthy.
  consumers = [startProductSyncConsumer(), startSupplierRefundConsumer()];

  // Start scheduled jobs (cron)
  startScheduler();

  // Mark as ready — health server will now return 200
  isReady = true;

  // Start health server
  healthServer.listen(WORKER_HEALTH_PORT, () => {
    logger.info(`[Worker] Health endpoint: http://localhost:${WORKER_HEALTH_PORT}/health`);
  });

  // Start periodic metric logging + Redis persistence
  workerMetrics.startPeriodicLogging();

  logger.info('[Worker] All consumers ready. Listening for events.');
};

let shuttingDown = false;

/**
 * Stops polling, lets running jobs finish, then exits. That can take one open
 * long poll (up to 20s) plus the longest running job — set the platform's
 * stop grace period to match. A second signal exits at once; SQS redelivers
 * the unfinished jobs after their visibility timeout.
 */
const gracefulShutdown = async (signal: string) => {
  if (shuttingDown) {
    logger.warn(
      `[Worker][Shutdown] Second ${signal} — exiting now. Unfinished jobs will be redelivered.`,
    );
    process.exit(1);
  }
  shuttingDown = true;
  logger.info(`[Worker][Shutdown] ${signal} received. Starting graceful shutdown...`);

  isReady = false;
  stopScheduler();
  workerMetrics.stop();
  healthServer.close();

  try {
    await Promise.all(consumers.map((consumer) => consumer.stop()));
    await redis.close();
    await prisma.$disconnect();

    logger.info('[Worker][Shutdown] All connections closed. Goodbye.');
    process.exit(0);
  } catch (err) {
    logger.error('[Worker][Shutdown] Error during cleanup:', err);
    process.exit(1);
  }
};

startWorker().catch((err) => {
  logger.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[Worker] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('[Worker] Uncaught Exception:', error);
  process.exit(1);
});
