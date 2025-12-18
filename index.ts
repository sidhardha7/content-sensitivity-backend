import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { port, clientOrigin } from './src/config/env';
import connectDB from './src/config/db';
import './src/models';
import authRoutes from './src/routes/auth.routes';
import adminRoutes from './src/routes/admin.routes';

const app = express();

// Connect to MongoDB
connectDB();

// Core middlewares
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
