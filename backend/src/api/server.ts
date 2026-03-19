import express from 'express';
import cors from 'cors';
import { ContractEventListener } from './events/contractEvents';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io' 
import { devicesRouter } from './routes/devices';
import { operatorsRouter } from './routes/operators';

export function createApiServer(): {
  start: (port: number) => void;
  stop: () => Promise<void>;
  eventListener: ContractEventListener;
} {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: 'http://localhost:4200',
      methods: ['GET', 'POST'],
    }
  });

  app.use(cors({ origin: 'http://localhost:4200'}));
  app.use(express.json());

  app.use('/api/devices', devicesRouter);
  app.use("/api/operators", operatorsRouter);

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[Socket.io] Client disconnected: ${socket.id}`));
  });

  const eventListener = new ContractEventListener(io);

  return {
    start: (port: number) => {
      eventListener.start();
      httpServer.listen(port, () => {
        console.log(`[API] REST server running on http://localhost:${port}`);
        console.log(`[API] WebSocket server running on ws://localhost:${port}`);
      });
    },
    stop: async () => {
      await eventListener.stop();
      io.disconnectSockets(true);
      await io.close();
      httpServer.close();
      console.log(`[API] Server stopped`);
    },
    eventListener
  }

}