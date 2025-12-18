import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();

// GET /api/admin/users - list users in the same tenant
router.get(
  '/users',
  authMiddleware,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const users = await User.find({ tenantId }).select('_id name email role isActive createdAt');
    return res.json({ users });
  }
);

// POST /api/admin/users - create a new user in the same tenant
router.post(
  '/users',
  authMiddleware,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const tenantId = req.user!.tenantId;

    // For now, new users get a temporary password the admin can share/reset elsewhere.
    const tempPassword = 'ChangeMe123!';

    const existing = await User.findOne({ tenantId, email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists in tenant' });
    }

    const { hashPassword } = await import('../services/authService');
    const passwordHash = await hashPassword(tempPassword);

    const user = await User.create({
      tenantId,
      name,
      email,
      role,
      passwordHash,
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

// PATCH /api/admin/users/:id - update role or activation
router.patch(
  '/users/:id',
  authMiddleware,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findOne({ _id: id, tenantId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role) {
      user.role = role;
    }
    if (typeof isActive === 'boolean') {
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

export default router;


