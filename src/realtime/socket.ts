import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/env';
import { AuthPayload } from '../middleware/auth';

export const setupSocketIO = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthPayload;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthPayload;

    if (!user) {
      socket.disconnect();
      return;
    }

    console.log(`[socket] User ${user.userId} (${user.role}) connected`);

    // Join tenant room for receiving updates
    socket.join(`tenant:${user.tenantId}`);

    // Join user-specific room (optional, for direct messages)
    socket.join(`user:${user.userId}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[socket] User ${user.userId} disconnected`);
    });

    // Optional: Handle custom events
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  return io;
};

