import cron from 'node-cron';
import {
  runScheduledProductSync,
  startScheduler,
  stopScheduler,
} from '../../src/infrastructure/scheduler';
import { redis } from '../../src/infrastructure/redis';
import { ProductSyncService } from '../../src/modules/catalog/product-sync.service';

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: jest.fn() },
}));

jest.mock('../../src/infrastructure/redis', () => ({
  redis: { getClient: jest.fn() },
}));

jest.mock('../../src/modules/catalog/product-sync.service', () => ({
  ProductSyncService: {
    resyncAll: jest.fn().mockResolvedValue({ jobsQueued: 2, productsQueued: 60 }),
  },
}));

const redisSet = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (redis.getClient as jest.Mock).mockReturnValue({ set: redisSet });
});

describe('scheduled product sync', () => {
  it('queues the resync when this worker wins the lock', async () => {
    redisSet.mockResolvedValue('OK');

    await runScheduledProductSync();

    expect(redisSet).toHaveBeenCalledWith(
      'scheduler:lock:product-sync',
      expect.any(String),
      expect.objectContaining({ NX: true, EX: expect.any(Number) }),
    );
    expect(ProductSyncService.resyncAll).toHaveBeenCalledTimes(1);
  });

  it('skips when another worker already queued this tick', async () => {
    redisSet.mockResolvedValue(null);

    await runScheduledProductSync();

    expect(ProductSyncService.resyncAll).not.toHaveBeenCalled();
  });

  it('still queues the resync when Redis is down (fails open)', async () => {
    (redis.getClient as jest.Mock).mockImplementation(() => {
      throw new Error('[Redis] Client not initialized');
    });

    await runScheduledProductSync();

    expect(ProductSyncService.resyncAll).toHaveBeenCalledTimes(1);
  });

  it('registers the 6-hourly tick and stops every task on shutdown', () => {
    const tasks: { stop: jest.Mock }[] = [];
    (cron.schedule as jest.Mock).mockImplementation(() => {
      const task = { stop: jest.fn() };
      tasks.push(task);
      return task;
    });

    startScheduler();
    expect(cron.schedule).toHaveBeenCalledWith('0 */6 * * *', runScheduledProductSync);

    stopScheduler();
    expect(tasks.length).toBeGreaterThan(0);
    tasks.forEach((task) => expect(task.stop).toHaveBeenCalledTimes(1));
  });
});
