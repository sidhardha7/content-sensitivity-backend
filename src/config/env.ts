import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'] as const;

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] Warning: ${key} is not set. Make sure to define it in your environment for non-dev environments.`);
  }
});

export const port = Number(process.env.PORT) || 5000;
export const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pulsegen';
export const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
export const nodeEnv = process.env.NODE_ENV || 'development';
export const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export default {
  port,
  mongoUri,
  jwtSecret,
  nodeEnv,
  clientOrigin,
};

