import express, { NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { port, clientOrigin } from './src/config/env';
import connectDB from './src/config/db';
import './src/models';
import { setupSocketIO } from './src/realtime/socket';
import authRoutes from './src/routes/auth.routes';
import adminRoutes from './src/routes/admin.routes';
import videoRoutes, { setSocketIO } from './src/routes/video.routes';

const app = express();
const httpServer = createServer(app);

// Connect to MongoDB
connectDB();

// Setup Socket.io
const io = setupSocketIO(httpServer);
setSocketIO(io);

// Core middlewares
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/videos', videoRoutes);

// Basic root route
app.get('/', (_req: Request, res: Response) => {
  res.send('Content Sensitivity API is running...');
});

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  res.status(err?.status || 500).json({
    message: err?.message || 'Internal Server Error',
  });
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Socket.io server initialized`);
});
