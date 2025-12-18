import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth';
import {
  createVideo,
  listVideos,
  listMyVideos,
  getVideoById,
  updateVideoStatus,
  deleteVideo,
  assignVideoToUsers,
  addUsersToVideo,
  removeUsersFromVideo,
} from '../services/videoService';

const router = Router();

// Configure multer for memory storage (we'll save to disk in the service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

// POST /api/videos/upload - Upload a new video (editor/admin only)
router.post(
  '/upload',
  authMiddleware,
  requireRole('editor', 'admin'),
  upload.single('video'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No video file provided' });
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }

      const video = await createVideo({
        title,
        description,
        file: req.file,
        ownerId: req.user.userId,
        tenantId: req.user.tenantId,
      });

      return res.status(201).json({
        video: {
          _id: video._id,
          title: video.title,
          description: video.description,
          status: video.status,
          safetyStatus: video.safetyStatus,
          size: video.size,
          createdAt: video.createdAt,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Upload failed' });
    }
  }
);

// GET /api/videos/my-videos - List videos owned by current user
// Available to all roles: shows videos where ownerId = current user's ID
router.get('/my-videos', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const { status, safetyStatus, fromDate, toDate, search } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (safetyStatus) filters.safetyStatus = safetyStatus;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);
    if (search) filters.search = search;

    const videos = await listMyVideos(req.user.tenantId, req.user.userId, filters);

    return res.json({
      videos: videos.map((v) => ({
        _id: v._id,
        title: v.title,
        description: v.description,
        originalFilename: v.originalFilename,
        size: v.size,
        duration: v.duration,
        status: v.status,
        safetyStatus: v.safetyStatus,
        owner: v.ownerId,
        assignedTo: v.assignedTo,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to list my videos' });
  }
});

// GET /api/videos - List videos for tenant (role-based access)
// - Viewers: Only see videos assigned to them (assignedTo contains their userId)
// - Editors: See videos they uploaded (ownerId = userId) OR videos assigned to them (assignedTo contains userId)
// - Admins: See ALL videos in tenant
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const { status, safetyStatus, fromDate, toDate, search } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (safetyStatus) filters.safetyStatus = safetyStatus;
    if (fromDate) filters.fromDate = new Date(fromDate as string);
    if (toDate) filters.toDate = new Date(toDate as string);
    if (search) filters.search = search;

    const videos = await listVideos(
      req.user.tenantId,
      filters,
      req.user.role,
      req.user.userId
    );

    return res.json({
      videos: videos.map((v) => ({
        _id: v._id,
        title: v.title,
        description: v.description,
        originalFilename: v.originalFilename,
        size: v.size,
        duration: v.duration,
        status: v.status,
        safetyStatus: v.safetyStatus,
        owner: v.ownerId,
        assignedTo: v.assignedTo,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to list videos' });
  }
});

// GET /api/videos/:id - Get single video details
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const video = await getVideoById(
      req.params.id,
      req.user.tenantId,
      req.user.role,
      req.user.userId
    );

    if (!video) {
      return res.status(404).json({ message: 'Video not found or access denied' });
    }

    return res.json({
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        originalFilename: video.originalFilename,
        size: video.size,
        duration: video.duration,
        status: video.status,
        safetyStatus: video.safetyStatus,
        owner: video.ownerId,
        assignedTo: video.assignedTo,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to get video' });
  }
});

// PATCH /api/videos/:id - Update video (editor/admin only)
// Editors can edit videos they own OR videos assigned to them
// Admins can edit ANY video in their tenant
router.patch(
  '/:id',
  authMiddleware,
  requireRole('editor', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const { title, description } = req.body;
      const updates: any = {};
      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;

      const video = await updateVideoStatus(
        req.params.id,
        req.user.tenantId,
        updates,
        req.user.role,
        req.user.userId
      );

      if (!video) {
        return res.status(404).json({ message: 'Video not found or access denied' });
      }

      return res.json({
        video: {
          _id: video._id,
          title: video.title,
          description: video.description,
          status: video.status,
          safetyStatus: video.safetyStatus,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || 'Failed to update video' });
    }
  }
);

// DELETE /api/videos/:id - Delete video (editor/admin only)
// Editors can delete videos they own OR videos assigned to them
// Admins can delete ANY video in their tenant
router.delete(
  '/:id',
  authMiddleware,
  requireRole('editor', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const deleted = await deleteVideo(
        req.params.id,
        req.user.tenantId,
        req.user.role,
        req.user.userId
      );

      if (!deleted) {
        return res.status(404).json({ message: 'Video not found or access denied' });
      }

      return res.json({ message: 'Video deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || 'Failed to delete video' });
    }
  }
);

// POST /api/videos/:id/assign - Assign video to users (editor/admin only)
router.post(
  '/:id/assign',
  authMiddleware,
  requireRole('editor', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'userIds array is required' });
      }

      try {
        const video = await assignVideoToUsers(
          req.params.id,
          req.user.tenantId,
          userIds,
          req.user.role,
          req.user.userId
        );

        return res.json({
          video: {
            _id: video._id,
            title: video.title,
            assignedTo: video.assignedTo,
          },
        });
      } catch (error: any) {
        if (error?.message === 'Video not found or access denied') {
          return res.status(404).json({ message: error.message });
        }
        throw error;
      }
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Failed to assign video' });
    }
  }
);

// POST /api/videos/:id/assign/add - Add users to video assignment (editor/admin only)
router.post(
  '/:id/assign/add',
  authMiddleware,
  requireRole('editor', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'userIds array is required' });
      }

      try {
        const video = await addUsersToVideo(
          req.params.id,
          req.user.tenantId,
          userIds,
          req.user.role,
          req.user.userId
        );

        return res.json({
          video: {
            _id: video._id,
            title: video.title,
            assignedTo: video.assignedTo,
          },
        });
      } catch (error: any) {
        if (error?.message === 'Video not found or access denied') {
          return res.status(404).json({ message: error.message });
        }
        throw error;
      }
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Failed to add users' });
    }
  }
);

// POST /api/videos/:id/assign/remove - Remove users from video assignment (editor/admin only)
router.post(
  '/:id/assign/remove',
  authMiddleware,
  requireRole('editor', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthenticated' });
      }

      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'userIds array is required' });
      }

      try {
        const video = await removeUsersFromVideo(
          req.params.id,
          req.user.tenantId,
          userIds,
          req.user.role,
          req.user.userId
        );

        return res.json({
          video: {
            _id: video._id,
            title: video.title,
            assignedTo: video.assignedTo,
          },
        });
      } catch (error: any) {
        if (error?.message === 'Video not found or access denied') {
          return res.status(404).json({ message: error.message });
        }
        throw error;
      }
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Failed to remove users' });
    }
  }
);

export default router;

