import { Router, Response } from "express";
import {
  AuthenticatedRequest,
  authMiddleware,
  requireRole,
} from "../middleware/auth";
import { User } from "../models/User";
import { Video } from "../models/Video";
import { deleteFile } from "../services/storageService";

const router = Router();

// GET /api/admin/users - list users in the same tenant
router.get(
  "/users",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const users = await User.find({ tenantId }).select(
      "_id name email role isActive createdAt"
    );
    return res.json({ users });
  }
);

// POST /api/admin/users - create a new user in the same tenant
router.post(
  "/users",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const tenantId = req.user!.tenantId;

    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = email.toLowerCase().trim();

    // For now, new users get a temporary password the admin can share/reset elsewhere.
    const tempPassword = "ChangeMe123!";

    const existing = await User.findOne({ tenantId, email: normalizedEmail });
    if (existing) {
      return res
        .status(400)
        .json({ message: "User with this email already exists in tenant" });
    }

    const { hashPassword } = await import("../services/authService");
    const passwordHash = await hashPassword(tempPassword);

    const user = await User.create({
      tenantId,
      name,
      email: normalizedEmail,
      role,
      passwordHash,
      isActive: true,
    });

    return res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tempPassword,
    });
  }
);

// PATCH /api/admin/users/:id - update user details
router.patch(
  "/users/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    const user = await User.findOne({ _id: id, tenantId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ tenantId, email: normalizedEmail });
      if (existing) {
        return res
          .status(400)
          .json({ message: "User with this email already exists in tenant" });
      }
      user.email = normalizedEmail;
    }

    if (name) {
      user.name = name;
    }
    if (role) {
      user.role = role;
    }
    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    await user.save();

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  }
);

// DELETE /api/admin/users/:id - delete a user
router.delete(
  "/users/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const user = await User.findOne({ _id: id, tenantId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user!.userId) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    try {
      // Find all videos owned by this user
      const ownedVideos = await Video.find({ ownerId: id, tenantId });
      
      // Delete all video files owned by this user
      for (const video of ownedVideos) {
        try {
          await deleteFile(video.storagePath);
        } catch (error) {
          // Log but don't fail if file doesn't exist
          console.error(`Failed to delete file ${video.storagePath}:`, error);
        }
      }

      // Delete all videos owned by this user
      await Video.deleteMany({ ownerId: id, tenantId });

      // Remove user from all assignedTo arrays in videos
      await Video.updateMany(
        { tenantId, assignedTo: id },
        { $pull: { assignedTo: id } }
      );

      // Delete the user
      await User.deleteOne({ _id: id, tenantId });

      return res.json({ 
        message: "User deleted successfully",
        deletedVideos: ownedVideos.length 
      });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res
        .status(500)
        .json({ message: error?.message || "Failed to delete user" });
    }
  }
);

// GET /api/admin/users/:id/videos - get video permissions for a user
router.get(
  "/users/:id/videos",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const user = await User.findOne({ _id: id, tenantId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { Video } = await import("../models/Video");
    const mongoose = await import("mongoose");

    // Get videos owned by this user
    const ownedVideos = await Video.find({
      tenantId,
      ownerId: id,
    })
      .select("_id title description status safetyStatus createdAt ownerId")
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    // Get videos assigned to this user
    const assignedVideos = await Video.find({
      tenantId,
      assignedTo: new mongoose.default.Types.ObjectId(id),
    })
      .select(
        "_id title description status safetyStatus createdAt ownerId assignedTo"
      )
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ownedVideos: ownedVideos.map((v: any) => ({
        _id: v._id,
        title: v.title,
        description: v.description,
        status: v.status,
        safetyStatus: v.safetyStatus,
        createdAt: v.createdAt,
        owner: {
          _id: v.ownerId._id || v.ownerId,
          name: v.ownerId.name || "",
          email: v.ownerId.email || "",
        },
        accessType: "owner",
      })),
      assignedVideos: assignedVideos.map((v: any) => ({
        _id: v._id,
        title: v.title,
        description: v.description,
        status: v.status,
        safetyStatus: v.safetyStatus,
        createdAt: v.createdAt,
        owner: {
          _id: v.ownerId._id || v.ownerId,
          name: v.ownerId.name || "",
          email: v.ownerId.email || "",
        },
        accessType: "assigned",
      })),
    });
  }
);

export default router;
