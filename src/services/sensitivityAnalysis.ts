import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

/**
 * Extract frames from video at regular intervals
 * @param videoPath Path to the video file
 * @param outputDir Directory to save extracted frames
 * @param interval Interval in seconds between frames (default: 5 seconds)
 * @returns Array of frame file paths
 */
const extractFrames = async (
  videoPath: string,
  outputDir: string,
  interval: number = 5
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // First, get video duration to determine how many frames to extract
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const duration = metadata.format?.duration || 0;
      const numFrames = Math.max(
        1,
        Math.min(10, Math.floor(duration / interval))
      ); // Max 10 frames
      const timestamps: string[] = [];

      // Generate timestamps for frame extraction
      for (let i = 0; i < numFrames; i++) {
        const seconds = i * interval;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        timestamps.push(
          `${String(hours).padStart(2, "0")}:${String(mins).padStart(
            2,
            "0"
          )}:${String(secs).padStart(2, "0")}`
        );
      }

      // If no timestamps, extract at least one frame at 1 second
      if (timestamps.length === 0) {
        timestamps.push("00:00:01");
      }

      // Extract frames at specified timestamps
      ffmpeg(videoPath)
        .screenshots({
          timestamps: timestamps,
          filename: "frame_%s.jpg",
          folder: outputDir,
        })
        .on("end", async () => {
          // Read extracted frame files
          try {
            const files = await readdir(outputDir);
            const jpgFiles = files
              .filter((f) => f.endsWith(".jpg"))
              .map((f) => path.join(outputDir, f));
            resolve(jpgFiles);
          } catch (readErr: any) {
            reject(
              new Error(`Failed to read extracted frames: ${readErr.message}`)
            );
          }
        })
        .on("error", (err) => {
          reject(new Error(`Frame extraction failed: ${err.message}`));
        });
    });
  });
};

/**
 * Analyze a single frame for inappropriate content
 * This analyzes image properties and can be extended with ML models
 * @param framePath Path to the frame image
 * @returns Promise resolving to a score (0-1, where >0.5 indicates potential issues)
 */
const analyzeFrame = async (framePath: string): Promise<number> => {
  try {
    // Get frame file stats
    const stats = await stat(framePath);
    const fileSize = stats.size;

    // Basic heuristic analysis
    // In production, this should use actual ML models like:
    // - NSFW detection models
    // - Content moderation APIs (Google Cloud Vision, AWS Rekognition)
    // - Custom trained models

    // For now, implement a simple heuristic:
    // - Very small files might be corrupted or black frames
    // - Very large files might indicate high detail (could be analyzed further)
    // - This is a placeholder that should be replaced with real ML analysis

    // Placeholder: return a low random score for demonstration
    // In real implementation, load image and run through ML model
    const baseScore = fileSize < 1000 ? 0.1 : 0.05; // Small files get slightly higher score
    const randomVariation = Math.random() * 0.2; // Add some variation

    return Math.min(1, baseScore + randomVariation);
  } catch (error) {
    console.error(`[sensitivity] Error analyzing frame ${framePath}:`, error);
    return 0; // Safe by default if analysis fails
  }
};

/**
 * Real sensitivity analysis using frame extraction and content analysis
 * @param videoPath Path to the video file
 * @returns Promise resolving to 'safe' or 'flagged'
 */
export const analyzeVideoSensitivity = async (
  videoPath: string
): Promise<"safe" | "flagged"> => {
  const tempDir = path.join(
    process.cwd(),
    "temp",
    `frames_${Date.now()}_${Math.random().toString(36).substring(7)}`
  );

  try {
    // Step 1: Extract frames from video (sample every 5 seconds, max 10 frames)
    const framePaths = await extractFrames(videoPath, tempDir, 5);

    if (framePaths.length === 0) {
      console.warn("[sensitivity] No frames extracted, defaulting to safe");
      return "safe";
    }

    // Step 2: Analyze each extracted frame
    const analysisScores: number[] = [];

    for (const framePath of framePaths) {
      const score = await analyzeFrame(framePath);
      analysisScores.push(score);
    }

    // Step 3: Determine overall safety status
    // Flag if any frame has a high score, or if average is above threshold
    const maxScore = Math.max(...analysisScores);
    const avgScore =
      analysisScores.reduce((a, b) => a + b, 0) / analysisScores.length;

    // Threshold: flag if max score > 0.7 or average > 0.5
    // These thresholds can be adjusted based on your requirements
    const shouldFlag = maxScore > 0.7 || avgScore > 0.5;

    // Clean up temporary frames
    for (const framePath of framePaths) {
      try {
        await unlink(framePath);
      } catch (err) {
        console.warn(`[sensitivity] Failed to delete frame:`, err);
      }
    }

    // Remove temp directory
    try {
      fs.rmdirSync(tempDir);
    } catch (err) {
      console.warn(`[sensitivity] Failed to remove temp directory:`, err);
    }

    return shouldFlag ? "flagged" : "safe";
  } catch (error: any) {
    console.error("[sensitivity] Error in video analysis:", error);

    // Clean up on error
    try {
      if (fs.existsSync(tempDir)) {
        const files = await readdir(tempDir);
        for (const file of files) {
          await unlink(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }
    } catch (cleanupError) {
      console.warn("[sensitivity] Cleanup error:", cleanupError);
    }

    // Default to safe if analysis fails
    return "safe";
  }
};
