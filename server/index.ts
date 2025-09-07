import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { allowedOrigins, PORT } from './config';
import { log } from './logger';
import { initializeDatabase } from './db';
import { registerSocketHandlers } from './socketHandlers';
import { startJobs } from './jobs';

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);
startJobs(io);

httpServer.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  initializeDatabase();
});

process.on('SIGTERM', () => {
  const mem = process.memoryUsage();
  console.error('[shutdown] SIGTERM received', { rss: mem.rss, heapUsed: mem.heapUsed });
  // 接続やタイマーをクリーンアップしてから
  process.exit(0);
});