import mongoose from 'mongoose';
import { mongoUri } from './env';

mongoose.set('strictQuery', true);

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(mongoUri);
    console.log('[db] MongoDB connected');
  } catch (error: any) {
    console.error('[db] MongoDB connection error:', error?.message || error);
    process.exit(1);
  }
};

export default connectDB;

