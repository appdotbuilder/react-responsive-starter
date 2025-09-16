import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { getCurrentUser } from '../handlers/get_current_user';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user' as const,
  is_active: true,
  email_verified: true
};

const inactiveUser = {
  email: 'inactive@example.com',
  password_hash: 'hashed_password_456',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'admin' as const,
  is_active: false,
  email_verified: true
};

describe('getCurrentUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user data for valid token', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create a valid session (expires in 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    const [session] = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid_token_123',
        expires_at: expiresAt
      })
      .returning()
      .execute();

    const result = await getCurrentUser('valid_token_123');

    expect(result).toBeDefined();
    expect(result!.id).toEqual(user.id);
    expect(result!.email).toEqual('test@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.last_name).toEqual('Doe');
    expect(result!.role).toEqual('user');
    expect(result!.is_active).toEqual(true);
    expect(result!.email_verified).toEqual(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    
    // Ensure password_hash is not included in response
    expect((result as any).password_hash).toBeUndefined();
  });

  it('should return null for invalid token', async () => {
    // Create a test user and session but use different token
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid_token_123',
        expires_at: expiresAt
      })
      .execute();

    const result = await getCurrentUser('invalid_token_456');
    expect(result).toBeNull();
  });

  it('should return null for expired token', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create an expired session (expired 1 hour ago)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() - 1);
    
    await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'expired_token_123',
        expires_at: expiresAt
      })
      .execute();

    const result = await getCurrentUser('expired_token_123');
    expect(result).toBeNull();
  });

  it('should return null for inactive user', async () => {
    // Create an inactive user
    const [user] = await db.insert(usersTable)
      .values(inactiveUser)
      .returning()
      .execute();

    // Create a valid session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid_token_inactive',
        expires_at: expiresAt
      })
      .execute();

    const result = await getCurrentUser('valid_token_inactive');
    expect(result).toBeNull();
  });

  it('should handle empty token', async () => {
    const result = await getCurrentUser('');
    expect(result).toBeNull();
  });

  it('should handle multiple sessions correctly', async () => {
    // Create a test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Create multiple sessions
    await db.insert(sessionsTable)
      .values([
        {
          user_id: user.id,
          token: 'token_1',
          expires_at: expiresAt
        },
        {
          user_id: user.id,
          token: 'token_2',
          expires_at: expiresAt
        }
      ])
      .execute();

    // Should return user for first token
    const result1 = await getCurrentUser('token_1');
    expect(result1).toBeDefined();
    expect(result1!.id).toEqual(user.id);

    // Should return user for second token
    const result2 = await getCurrentUser('token_2');
    expect(result2).toBeDefined();
    expect(result2!.id).toEqual(user.id);

    // Should return null for non-existent token
    const result3 = await getCurrentUser('token_3');
    expect(result3).toBeNull();
  });
});