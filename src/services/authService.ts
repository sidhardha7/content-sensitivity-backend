import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/env";
import Tenant, { ITenant } from "../models/Tenant";
import User, { IUser, Role } from "../models/User";

const SALT_ROUNDS = 10;

export interface RegisterInput {
  tenantName: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: Pick<IUser, "_id" | "name" | "email" | "role"> & { tenantId: string };
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const signToken = (user: IUser): string => {
  const payload = {
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: user.role as Role,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
};

export const registerFirstAdmin = async (
  input: RegisterInput
): Promise<AuthResult> => {
  // Auto-generate slug from tenant name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  let baseSlug = generateSlug(input.tenantName);
  let tenantSlug = baseSlug;
  let counter = 1;

  // Ensure slug is unique
  while (await Tenant.findOne({ slug: tenantSlug })) {
    tenantSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Check if email already exists globally
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Create tenant
  const tenant: ITenant = await Tenant.create({
    name: input.tenantName,
    slug: tenantSlug,
  });

  // Create admin user for this tenant
  const passwordHash = await hashPassword(input.password);

  const user = await User.create({
    tenantId: tenant._id,
    name: input.name,
    email: input.email,
    passwordHash,
    role: "admin",
  });

  const token = signToken(user);

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId.toString(),
    },
  };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const normalizedEmail = input.email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.isActive) {
    throw new Error("Inactive user");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = signToken(user);

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId.toString(),
    },
  };
};
