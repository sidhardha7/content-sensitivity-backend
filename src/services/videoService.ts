import path from 'path';
import { Video, IVideo, VideoStatus, SafetyStatus } from '../models/Video';
import { saveUpload, deleteFile } from './storageService';

export interface CreateVideoInput {
  title: string;
  description?: string;
  file: Express.Multer.File;
  ownerId: string;
  tenantId: string;
}

export interface ListVideosFilters {
  status?: VideoStatus;
  safetyStatus?: SafetyStatus;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
}

/**
 * Create a new video record and save the file
 */
export const createVideo = async (input: CreateVideoInput): Promise<IVideo> => {
  // Generate unique filename
  const timestamp = Date.now();
  const filename = `${timestamp}-${input.file.originalname}`;

  // Save file to storage
  const { relativePath } = await saveUpload(input.file, input.tenantId, filename);

  // Create video record
  const video = await Video.create({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    assignedTo: [], // Initially no assignments
    title: input.title,
    description: input.description,
    originalFilename: input.file.originalname,
    storagePath: relativePath,
    mimeType: input.file.mimetype,
    size: input.file.size,
    status: 'uploaded',
    safetyStatus: 'unknown',
  });

  return video;
};

/**
 * List videos for a tenant with filters
 */
export const listVideos = async (
  tenantId: string,
  filters: ListVideosFilters = {},
  userRole: string,
  userId?: string,
  ownerId?: string
): Promise<IVideo[]> => {
  const query: any = { tenantId };

  // Filter by owner if specified
  if (ownerId) {
    query.ownerId = ownerId;
  }

  // Role-based access control:
  // - Viewers: Only see videos assigned to them (assignedTo contains their userId)
  // - Editors: See videos they uploaded (ownerId = userId) OR videos assigned to them (assignedTo contains userId)
  // - Admins: See all videos in tenant
  if (userRole === 'viewer' && userId) {
    query.assignedTo = userId;
  } else if (userRole === 'editor' && userId) {
    // Editors see: videos they own OR videos assigned to them
    query.$or = [
      { ownerId: userId },
      { assignedTo: userId },
    ];
  }
  // Admins see all videos in tenant (no additional filter needed)

  // Apply filters
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.safetyStatus) {
    query.safetyStatus = filters.safetyStatus;
  }
  if (filters.fromDate || filters.toDate) {
    query.createdAt = {};
    if (filters.fromDate) {
      query.createdAt.$gte = filters.fromDate;
    }
    if (filters.toDate) {
      query.createdAt.$lte = filters.toDate;
    }
  }
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const videos = await Video.find(query)
    .sort({ createdAt: -1 })
    .populate('ownerId', 'name email')
    .populate('assignedTo', 'name email')
    .exec();

  return videos;
};

/**
 * List videos owned by a specific user
 */
export const listMyVideos = async (
  tenantId: string,
  ownerId: string,
  filters: ListVideosFilters = {}
): Promise<IVideo[]> => {
  return listVideos(tenantId, filters, '', undefined, ownerId);
};

/**
 * Assign video to users (for viewers)
 * Editors can only assign videos they own
 * Admins can assign any video in tenant
 */
export const assignVideoToUsers = async (
  videoId: string,
  tenantId: string,
  userIds: string[],
  userRole?: string,
  userId?: string
): Promise<IVideo> => {
  // Verify all users belong to the same tenant
  const { User } = await import('../models/User');
  const users = await User.find({
    _id: { $in: userIds },
    tenantId,
  });

  if (users.length !== userIds.length) {
    throw new Error('Some users not found or belong to different tenant');
  }

  const query: any = { _id: videoId, tenantId };

  // Editors can only assign videos they own
  if (userRole === 'editor' && userId) {
    query.ownerId = userId;
  }
  // Admins can assign any video (no additional filter)

  const video = await Video.findOneAndUpdate(query, { $set: { assignedTo: userIds } }, { new: true })
    .populate('assignedTo', 'name email')
    .exec();

  if (!video) {
    throw new Error('Video not found or access denied');
  }

  return video;
};

/**
 * Add users to video assignment (append, don't replace)
 * Editors can only add users to videos they own
 * Admins can add users to any video in tenant
 */
export const addUsersToVideo = async (
  videoId: string,
  tenantId: string,
  userIds: string[],
  userRole?: string,
  userId?: string
): Promise<IVideo> => {
  // Verify all users belong to the same tenant
  const { User } = await import('../models/User');
  const users = await User.find({
    _id: { $in: userIds },
    tenantId,
  });

  if (users.length !== userIds.length) {
    throw new Error('Some users not found or belong to different tenant');
  }

  const query: any = { _id: videoId, tenantId };

  // Editors can only add users to videos they own
  if (userRole === 'editor' && userId) {
    query.ownerId = userId;
  }
  // Admins can add users to any video (no additional filter)

  const video = await Video.findOneAndUpdate(
    query,
    { $addToSet: { assignedTo: { $each: userIds } } }, // Add unique users only
    { new: true }
  )
    .populate('assignedTo', 'name email')
    .exec();

  if (!video) {
    throw new Error('Video not found or access denied');
  }

  return video;
};

/**
 * Remove users from video assignment
 * Editors can only remove users from videos they own
 * Admins can remove users from any video in tenant
 */
export const removeUsersFromVideo = async (
  videoId: string,
  tenantId: string,
  userIds: string[],
  userRole?: string,
  userId?: string
): Promise<IVideo> => {
  const query: any = { _id: videoId, tenantId };

  // Editors can only remove users from videos they own
  if (userRole === 'editor' && userId) {
    query.ownerId = userId;
  }
  // Admins can remove users from any video (no additional filter)

  const video = await Video.findOneAndUpdate(query, { $pull: { assignedTo: { $in: userIds } } }, { new: true })
    .populate('assignedTo', 'name email')
    .exec();

  if (!video) {
    throw new Error('Video not found or access denied');
  }

  return video;
};

/**
 * Get a single video by ID (with tenant check and role-based access)
 * 
 * Access rules:
 * - Viewers: Can only access if they're in assignedTo array
 * - Editors: Can access if they own it (ownerId = userId) OR if assigned to them (assignedTo contains userId)
 * - Admins: Can access all videos in tenant
 */
export const getVideoById = async (
  videoId: string,
  tenantId: string,
  userRole?: string,
  userId?: string
): Promise<IVideo | null> => {
  const query: any = { _id: videoId, tenantId };

  // Viewers can only access videos assigned to them
  if (userRole === 'viewer' && userId) {
    query.assignedTo = userId;
  } else if (userRole === 'editor' && userId) {
    // Editors can access: videos they own OR videos assigned to them
    query.$or = [
      { ownerId: userId },
      { assignedTo: userId },
    ];
  }
  // Admins can access all videos in tenant (no filter needed)

  const video = await Video.findOne(query)
    .populate('ownerId', 'name email')
    .populate('assignedTo', 'name email')
    .exec();

  return video;
};

/**
 * Update video status
 * Editors can only update videos they own OR videos assigned to them
 * Admins can update any video in tenant
 */
export const updateVideoStatus = async (
  videoId: string,
  tenantId: string,
  updates: Partial<IVideo>,
  userRole?: string,
  userId?: string
): Promise<IVideo | null> => {
  const query: any = { _id: videoId, tenantId };

  // Editors can only update videos they own OR videos assigned to them
  if (userRole === 'editor' && userId) {
    query.$or = [
      { ownerId: userId },
      { assignedTo: userId },
    ];
  }
  // Admins can update any video (no additional filter)

  const video = await Video.findOneAndUpdate(query, { $set: updates }, { new: true });

  return video;
};

/**
 * Delete video and its file
 * Editors can only delete videos they own OR videos assigned to them
 * Admins can delete any video in tenant
 */
export const deleteVideo = async (
  videoId: string,
  tenantId: string,
  userRole?: string,
  userId?: string
): Promise<boolean> => {
  const query: any = { _id: videoId, tenantId };

  // Editors can only delete videos they own OR videos assigned to them
  if (userRole === 'editor' && userId) {
    query.$or = [
      { ownerId: userId },
      { assignedTo: userId },
    ];
  }
  // Admins can delete any video (no additional filter)

  const video = await Video.findOne(query);
  if (!video) {
    return false;
  }

  // Delete file from storage
  await deleteFile(video.storagePath);

  // Delete record
  await Video.deleteOne({ _id: videoId, tenantId });

  return true;
};

