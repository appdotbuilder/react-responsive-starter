import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type UpdateProfileInput } from '../schema';
import { updateProfile } from '../handlers/update_profile';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  role: 'user' as const,
  is_active: true,
  email_verified: true
};

const testUpdateInput: UpdateProfileInput = {
  first_name: 'Jane',
  last_name: 'Smith'
};

describe('updateProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user profile with valid token', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid-token-123',
        expires_at: new Date(Date.now() + 3600000) // 1 hour from now
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Update profile
    const result = await updateProfile(session.token, testUpdateInput);

    // Verify result
    expect(result.id).toEqual(user.id);
    expect(result.email).toEqual(testUser.email);
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.role).toEqual('user');
    expect(result.is_active).toEqual(true);
    expect(result.email_verified).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > result.created_at).toBe(true);

    // Verify password_hash is not included in response
    expect('password_hash' in result).toBe(false);
  });

  it('should update profile in database', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid-token-456',
        expires_at: new Date(Date.now() + 3600000)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    const originalUpdatedAt = user.updated_at;

    // Update profile
    await updateProfile(session.token, testUpdateInput);

    // Verify database was updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers).toHaveLength(1);
    const updatedUser = updatedUsers[0];
    expect(updatedUser.first_name).toEqual('Jane');
    expect(updatedUser.last_name).toEqual('Smith');
    expect(updatedUser.email).toEqual(testUser.email);
    expect(updatedUser.updated_at > originalUpdatedAt).toBe(true);
  });

  it('should update only provided fields', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid-token-789',
        expires_at: new Date(Date.now() + 3600000)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Update only first name
    const partialInput: UpdateProfileInput = {
      first_name: 'Updated'
    };

    const result = await updateProfile(session.token, partialInput);

    // Verify only first_name was updated
    expect(result.first_name).toEqual('Updated');
    expect(result.last_name).toEqual('Doe'); // Should remain unchanged
    expect(result.email).toEqual(testUser.email);
  });

  it('should handle empty update input', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid-token-empty',
        expires_at: new Date(Date.now() + 3600000)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Update with empty input
    const emptyInput: UpdateProfileInput = {};
    const result = await updateProfile(session.token, emptyInput);

    // Verify no fields changed except updated_at
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.updated_at > user.updated_at).toBe(true);
  });

  it('should throw error for invalid token', async () => {
    // Create test user (but no session)
    await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Try to update with invalid token
    await expect(updateProfile('invalid-token', testUpdateInput))
      .rejects.toThrow(/invalid or expired token/i);
  });

  it('should throw error for expired token', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create expired session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'expired-token-123',
        expires_at: new Date(Date.now() - 3600000) // 1 hour ago (expired)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Try to update with expired token
    await expect(updateProfile(session.token, testUpdateInput))
      .rejects.toThrow(/invalid or expired token/i);
  });

  it('should work with admin user', async () => {
    // Create admin user
    const adminUser = {
      ...testUser,
      email: 'admin@example.com',
      role: 'admin' as const
    };

    const userResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();
    const user = userResult[0];

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'admin-token-123',
        expires_at: new Date(Date.now() + 3600000)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Update profile
    const result = await updateProfile(session.token, testUpdateInput);

    // Verify admin role is preserved
    expect(result.role).toEqual('admin');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.email).toEqual('admin@example.com');
  });

  it('should update updated_at timestamp even with no changes', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user = userResult[0];
    const originalUpdatedAt = user.updated_at;

    // Create valid session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'timestamp-token-123',
        expires_at: new Date(Date.now() + 3600000)
      })
      .returning()
      .execute();
    const session = sessionResult[0];

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Update with same values
    const sameValuesInput: UpdateProfileInput = {
      first_name: 'John',
      last_name: 'Doe'
    };

    const result = await updateProfile(session.token, sameValuesInput);

    // Verify updated_at was still updated
    expect(result.updated_at > originalUpdatedAt).toBe(true);
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
  });
});