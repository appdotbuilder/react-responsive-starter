import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type SignupInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// Simple password hashing using built-in crypto (for production, use bcrypt)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_secret'); // In production, use proper salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Generate secure random token
const generateToken = (): string => {
  return randomBytes(32).toString('hex');
};

export const signup = async (input: SignupInput): Promise<AuthResponse> => {
  try {
    // 1. Check if email already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('Email already exists');
    }

    // 2. Hash the password securely
    const passwordHash = await hashPassword(input.password);

    // 3. Create new user record in database
    const userResult = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: 'user',
        is_active: true,
        email_verified: false
      })
      .returning()
      .execute();

    const newUser = userResult[0];

    // 4. Generate authentication token
    const token = generateToken();

    // 5. Create session record (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(sessionsTable)
      .values({
        user_id: newUser.id,
        token: token,
        expires_at: expiresAt
      })
      .execute();

    // 6. Return user info (without password) and token
    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        is_active: newUser.is_active,
        email_verified: newUser.email_verified,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      },
      token: token
    };
  } catch (error) {
    console.error('Signup failed:', error);
    throw error;
  }
};