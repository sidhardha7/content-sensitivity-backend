import mongoose, { Document, Model } from 'mongoose';

export type VideoStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type SafetyStatus = 'unknown' | 'safe' | 'flagged';

export interface IVideo extends Document {
  tenantId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[]; // Users who have access to this video (for viewers)
  title: string;
  description?: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  duration?: number;
  status: VideoStatus;
  safetyStatus: SafetyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const videoSchema = new mongoose.Schema<IVideo>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'processed', 'failed'],
      default: 'uploaded',
    },
    safetyStatus: {
      type: String,
      enum: ['unknown', 'safe', 'flagged'],
      default: 'unknown',
    },
  },
  { timestamps: true }
);

// Index for efficient queries
videoSchema.index({ tenantId: 1, createdAt: -1 });
videoSchema.index({ tenantId: 1, status: 1 });
videoSchema.index({ tenantId: 1, safetyStatus: 1 });
videoSchema.index({ assignedTo: 1 }); // For viewer access queries

export const Video: Model<IVideo> = mongoose.model<IVideo>('Video', videoSchema);

export default Video;

