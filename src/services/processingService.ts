import { Video, IVideo } from "../models/Video";
import { updateVideoStatus } from "./videoService";
import { getFilePath } from "./storageService";
import ffmpeg from "fluent-ffmpeg";
import { Server as SocketIOServer } from "socket.io";
import { analyzeVideoSensitivity } from "./sensitivityAnalysis";

/**
 * Get video duration and basic metadata using FFmpeg
 */
const getVideoMetadata = (videoPath: string): Promise<{ duration: number }> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        // If FFmpeg fails, return default values
        console.warn("[processing] FFmpeg probe failed:", err.message);
        resolve({ duration: 0 });
        return;
      }

      const duration = metadata.format?.duration || 0;
      resolve({ duration: Math.round(duration) });
    });
  });
};

export interface ProcessingJob {
  videoId: string;
  tenantId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  safetyStatus?: "safe" | "flagged";
}

// In-memory job queue (in production, use Redis or a proper queue system)
const processingQueue: Map<string, ProcessingJob> = new Map();

/**
 * Process a video: extract metadata, run sensitivity analysis, update status
 */
export const processVideo = async (
  videoId: string,
  tenantId: string,
  io?: SocketIOServer
): Promise<void> => {
  try {
    // Get video from database
    const video = await Video.findOne({ _id: videoId, tenantId });
    if (!video) {
      throw new Error("Video not found");
    }

    // Create job entry
    const job: ProcessingJob = {
      videoId,
      tenantId,
      status: "queued",
      progress: 0,
    };
    processingQueue.set(videoId, job);

    // Update video status to processing
    await updateVideoStatus(
      videoId,
      tenantId,
      { status: "processing" },
      undefined,
      undefined
    );
    job.status = "processing";
    job.progress = 10;

    // Emit start event
    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:start", {
        videoId,
        status: "processing",
        progress: 10,
      });
    }

    // Step 1: Extract video metadata (30% progress)
    const filePath = getFilePath(video.storagePath);
    const metadata = await getVideoMetadata(filePath);
    job.progress = 30;

    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:progress", {
        videoId,
        status: "processing",
        progress: 30,
        message: "Extracting video metadata...",
      });
    }

    // Update video with duration
    await updateVideoStatus(
      videoId,
      tenantId,
      { duration: metadata.duration },
      undefined,
      undefined
    );

    // Step 2: Run sensitivity analysis (30% -> 80% progress)
    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:progress", {
        videoId,
        status: "processing",
        progress: 50,
        message: "Analyzing content sensitivity...",
      });
    }

    const safetyStatus = await analyzeVideoSensitivity(filePath);
    job.progress = 80;
    job.safetyStatus = safetyStatus;

    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:progress", {
        videoId,
        status: "processing",
        progress: 80,
        message: "Finalizing results...",
      });
    }

    // Step 3: Update video with final status (80% -> 100%)
    await updateVideoStatus(
      videoId,
      tenantId,
      {
        status: "processed",
        safetyStatus,
      },
      undefined,
      undefined
    );

    job.status = "completed";
    job.progress = 100;

    // Emit completion event
    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:completed", {
        videoId,
        status: "processed",
        progress: 100,
        safetyStatus,
        duration: metadata.duration,
      });
    }

    // Clean up job
    processingQueue.delete(videoId);
  } catch (error: any) {
    console.error("[processing] Error processing video:", error);

    // Update video status to failed
    await updateVideoStatus(
      videoId,
      tenantId,
      { status: "failed" },
      undefined,
      undefined
    ).catch((err) =>
      console.error("[processing] Failed to update video status:", err)
    );

    // Emit error event
    if (io) {
      io.to(`tenant:${tenantId}`).emit("processing:failed", {
        videoId,
        status: "failed",
        error: error?.message || "Processing failed",
      });
    }

    // Clean up job
    processingQueue.delete(videoId);
  }
};

/**
 * Get processing status for a video
 */
export const getProcessingStatus = (videoId: string): ProcessingJob | null => {
  return processingQueue.get(videoId) || null;
};
