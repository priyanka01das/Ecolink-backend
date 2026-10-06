import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export const initSocket = (server, corsOptions) => {
  io = new Server(server, {
    cors: corsOptions
  });

  const JWT_SECRET = process.env.JWT_SECRET || 'ecolink-production-jwt-secret-key-2026';

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

    // Handle authentication event from client
    socket.on('authenticate', (token) => {
      try {
        if (!token) {
          socket.emit('authenticated', { success: false, message: 'No token provided' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id.toString();

        // Join user-specific socket room
        socket.join(userId);
        socket.userId = userId;

        console.log(`👤 User authenticated and joined socket room: ${userId} (${socket.id})`);
        socket.emit('authenticated', { success: true, userId });
      } catch (err) {
        console.error(`❌ Socket authentication error: ${err.message}`);
        socket.emit('authenticated', { success: false, message: 'Invalid or expired token' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Emit real-time notification to a specific user's socket room
 * @param {string|ObjectId} recipientId - User ID to receive the notification
 * @param {Object} notification - Notification document/payload
 */
export const emitNotificationToUser = (recipientId, notification) => {
  if (io && recipientId) {
    const room = recipientId.toString();
    io.to(room).emit('notification', notification);
    console.log(`📡 Real-time notification emitted to user room [${room}]`);
  }
};
