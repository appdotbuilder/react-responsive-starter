import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing simulation (in real app, use bcrypt)
const hashPassword = (password: string): string => {
  return `hashed_${password}`;
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hash === `hashed_${password}`;
};

// Simple JWT token generation (in real app, use proper JWT library)
const generateToken = (): string => {
  return `jwt_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  try {
    // 1. Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // 2. Verify password against stored hash
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid email or password');
    }

    // 3. Check if user is active and verified
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    if (!user.email_verified) {
      throw new Error('Email not verified');
    }

    // 4. Generate new authentication token
    const token = generateToken();

    // 5. Create session record with expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: token,
        expires_at: expiresAt
      })
      .execute();

    // 6. Return user info (without password) and token
    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token: token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};