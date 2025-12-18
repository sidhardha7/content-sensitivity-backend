import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { port, clientOrigin } from './src/config/env';
import connectDB from './src/config/db';

const app = express();

// Connect to MongoDB (Atlas or local, depending on env)
connectDB();

// Core middlewares
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Basic root route
app.get('/', (_req: Request, res: Response) => {
  res.send('Content Sensitivity API is running...');
});

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is healthy' });
});

// Global error handler placeholder – to be expanded later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  const status = err?.status || 500;
  res.status(status).json({
    message: err?.message || 'Internal Server Error',
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
