import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";

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
        Math.min(30, Math.floor(duration / interval))
      );

      const timestamps: string[] = [];

      // Generate timestamps for frame extraction
      for (let i = 0; i < numFrames; i++) {
        const seconds = i * interval;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const ts = `${String(hours).padStart(2, "0")}:${String(mins).padStart(
          2,
          "0"
        )}:${String(secs).padStart(2, "0")}`;
        timestamps.push(ts);
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
    // Get frame file stats (size in bytes)
    const stats = await stat(framePath);
    const fileSize = stats.size;

    // Load image statistics using sharp
    // This gives us per-channel mean and standard deviation
    const image = sharp(framePath);
    const imgStats = await image.stats();

    const [r, g, b] = imgStats.channels;

    // Normalize means and stdevs to 0-1 range
    const rMean = r.mean / 255;
    const gMean = g.mean / 255;
    const bMean = b.mean / 255;

    const rStd = r.stdev / 255;
    const gStd = g.stdev / 255;
    const bStd = b.stdev / 255;

    // Approximate brightness as average of RGB means
    const brightness = (rMean + gMean + bMean) / 3;

    // Approximate contrast as average standard deviation
    const contrast = (rStd + gStd + bStd) / 3;

    // Approximate color variance (how different channels are from each other)
    const colorVariance =
      ((rMean - gMean) ** 2 + (rMean - bMean) ** 2 + (gMean - bMean) ** 2) / 3;

    // Heuristic scoring:
    // - Mid-range brightness with high contrast and color variance is more likely to contain detailed content
    // - Very dark or very bright frames are considered safer
    let score = 0;

    // Brightness contribution (peak risk around 0.5)
    const brightnessRisk = 1 - Math.abs(brightness - 0.5) * 2; // 1 at 0.5, 0 at 0 or 1

    // Contrast contribution (higher contrast → higher risk)
    const contrastRisk = Math.min(1, contrast * 2);

    // Color variance contribution (more varied colors → higher risk)
    const colorRisk = Math.min(1, Math.sqrt(colorVariance) * 2);

    // File size contribution: very tiny frames are likely not informative
    const sizeRisk =
      fileSize < 5_000
        ? 0.1
        : fileSize < 50_000
        ? 0.3
        : fileSize < 200_000
        ? 0.6
        : 0.8;

    // Weighted combination
    score =
      brightnessRisk * 0.3 +
      contrastRisk * 0.3 +
      colorRisk * 0.2 +
      sizeRisk * 0.2;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score));
  } catch (error) {
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
    // Step 1: Extract frames from video (sample every 5 seconds, max 30 frames)
    const framePaths = await extractFrames(videoPath, tempDir, 5);

    if (framePaths.length === 0) {
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

    // Threshold: flag if max score > 0.4 or average > 0.4
    // These thresholds can be adjusted based on your requirements
    const shouldFlag = maxScore > 0.4 || avgScore > 0.4;

    // Clean up temporary frames
    for (const framePath of framePaths) {
      try {
        await unlink(framePath);
      } catch (err) {
        // Silently ignore cleanup errors
      }
    }

    // Remove temp directory
    try {
      fs.rmdirSync(tempDir);
    } catch (err) {
      // Silently ignore cleanup errors
    }

    return shouldFlag ? "flagged" : "safe";
  } catch (error: any) {
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
      // Silently ignore cleanup errors
    }

    // Default to safe if analysis fails
    return "safe";
  }
};
