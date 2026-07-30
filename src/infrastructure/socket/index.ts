import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisConnection } from '../redis/connection';
import logger from '../../utils/logger';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  try {
    const pubClient = redisConnection.getClient();
    if (pubClient && pubClient.isOpen) {
      const subClient = pubClient.duplicate();
      subClient
        .connect()
        .then(() => {
          io?.adapter(createAdapter(pubClient, subClient));
          logger.info('🔌 Socket.io Redis adapter connected');
        })
        .catch((err) => {
          logger.warn(`⚠️ Socket.io Redis adapter setup warning: ${err.message}`);
        });
    }
  } catch (err: any) {
    logger.warn(`⚠️ Socket.io Redis adapter skipped: ${err?.message || err}`);
  }

  io.on('connection', (socket) => {
    logger.info(`⚡ Socket.io client connected: ${socket.id}`);

    // Join tenant room for real-time notifications
    socket.on('join_tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
      logger.info(`Socket ${socket.id} joined room tenant:${tenantId}`);
    });

    // Join customer room for order status pushes
    socket.on('join_customer', (customerId: string) => {
      socket.join(`customer:${customerId}`);
      logger.info(`Socket ${socket.id} joined room customer:${customerId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`⚡ Socket.io client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocketIO(server) first.');
  }
  return io;
}
