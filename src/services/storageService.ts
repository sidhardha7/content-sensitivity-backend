import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface SaveUploadResult {
  filePath: string;
  relativePath: string;
}

/**
 * Save uploaded file to tenant-specific directory
 */
export const saveUpload = async (
  file: Express.Multer.File,
  tenantId: string,
  filename: string
): Promise<SaveUploadResult> => {
  const tenantDir = path.join(UPLOAD_DIR, tenantId);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }

  const filePath = path.join(tenantDir, filename);
  const relativePath = path.join(tenantId, filename);

  // Write file
  await fs.promises.writeFile(filePath, file.buffer);

  return {
    filePath,
    relativePath,
  };
};

/**
 * Get file path for a video
 */
export const getFilePath = (relativePath: string): string => {
  return path.join(UPLOAD_DIR, relativePath);
};

/**
 * Check if file exists
 */
export const fileExists = (relativePath: string): boolean => {
  const fullPath = getFilePath(relativePath);
  return fs.existsSync(fullPath);
};

/**
 * Get file stream for streaming
 */
export const getFileStream = (relativePath: string): Readable => {
  const fullPath = getFilePath(relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('File not found');
  }
  return fs.createReadStream(fullPath);
};

/**
 * Get file stats (size, etc.)
 */
export const getFileStats = async (relativePath: string): Promise<fs.Stats> => {
  const fullPath = getFilePath(relativePath);
  return fs.promises.stat(fullPath);
};

/**
 * Delete file
 */
export const deleteFile = async (relativePath: string): Promise<void> => {
  const fullPath = getFilePath(relativePath);
  if (fs.existsSync(fullPath)) {
    await fs.promises.unlink(fullPath);
  }
};

