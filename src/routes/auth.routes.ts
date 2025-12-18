import { Router, Request, Response } from 'express';
import { registerFirstAdmin, login } from '../services/authService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { tenantName, name, email, password } = req.body;

    if (!tenantName || !name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await registerFirstAdmin({ tenantName, name, email, password });
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await login({ email, password });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(401).json({ message: error?.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  const user = await User.findById(req.user.userId).select('_id name email role tenantId');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId.toString(),
    },
  });
});

export default router;


