import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/login';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password123', // This matches our simple hashing
  first_name: 'John',
  last_name: 'Doe',
  role: 'user' as const,
  is_active: true,
  email_verified: true
};

const loginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully login a valid user', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await login(loginInput);

    // Verify response structure
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.first_name).toEqual(testUser.first_name);
    expect(result.user.last_name).toEqual(testUser.last_name);
    expect(result.user.role).toEqual(testUser.role);
    expect(result.user.is_active).toEqual(true);
    expect(result.user.email_verified).toEqual(true);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Verify token is generated
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.startsWith('jwt_')).toBe(true);

    // Verify password is not included in response
    expect((result.user as any).password_hash).toBeUndefined();
  });

  it('should create a session record on successful login', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    const result = await login(loginInput);

    // Verify session was created
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, result.token))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].user_id).toEqual(userId);
    expect(sessions[0].token).toEqual(result.token);
    expect(sessions[0].expires_at).toBeInstanceOf(Date);
    expect(sessions[0].created_at).toBeInstanceOf(Date);

    // Verify session expires in the future (24 hours)
    const now = new Date();
    const expirationTime = sessions[0].expires_at.getTime() - now.getTime();
    expect(expirationTime).toBeGreaterThan(23 * 60 * 60 * 1000); // At least 23 hours
    expect(expirationTime).toBeLessThan(25 * 60 * 60 * 1000); // Less than 25 hours
  });

  it('should reject login with invalid email', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const invalidEmailInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(login(invalidEmailInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with invalid password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const invalidPasswordInput: LoginInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    await expect(login(invalidPasswordInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login for inactive user', async () => {
    // Create inactive user
    const inactiveUser = {
      ...testUser,
      is_active: false
    };

    await db.insert(usersTable)
      .values(inactiveUser)
      .execute();

    await expect(login(loginInput)).rejects.toThrow(/account is deactivated/i);
  });

  it('should reject login for unverified user', async () => {
    // Create unverified user
    const unverifiedUser = {
      ...testUser,
      email_verified: false
    };

    await db.insert(usersTable)
      .values(unverifiedUser)
      .execute();

    await expect(login(loginInput)).rejects.toThrow(/email not verified/i);
  });

  it('should handle admin user login correctly', async () => {
    // Create admin user
    const adminUser = {
      ...testUser,
      email: 'admin@example.com',
      role: 'admin' as const
    };

    await db.insert(usersTable)
      .values(adminUser)
      .execute();

    const adminLoginInput: LoginInput = {
      email: 'admin@example.com',
      password: 'password123'
    };

    const result = await login(adminLoginInput);

    expect(result.user.role).toEqual('admin');
    expect(result.user.email).toEqual('admin@example.com');
    expect(result.token).toBeDefined();
  });

  it('should create multiple sessions for same user', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = users[0].id;

    // Login multiple times
    const result1 = await login(loginInput);
    const result2 = await login(loginInput);

    // Verify both sessions exist
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, userId))
      .execute();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].token).not.toEqual(sessions[1].token);
    expect(result1.token).not.toEqual(result2.token);
  });
});