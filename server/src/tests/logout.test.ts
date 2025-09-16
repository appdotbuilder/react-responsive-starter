import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { logout } from '../handlers/logout';
import { eq } from 'drizzle-orm';

describe('logout', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully logout with valid token', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        is_active: true,
        email_verified: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a test session
    const sessionResult = await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'valid_test_token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      })
      .returning()
      .execute();

    const session = sessionResult[0];

    // Logout with the valid token
    const result = await logout('valid_test_token');

    // Should return success
    expect(result.success).toBe(true);

    // Verify session was deleted from database
    const remainingSessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, session.id))
      .execute();

    expect(remainingSessions).toHaveLength(0);
  });

  it('should return success even with invalid token', async () => {
    // Logout with non-existent token
    const result = await logout('invalid_token');

    // Should still return success (prevents timing attacks)
    expect(result.success).toBe(true);
  });

  it('should handle empty token gracefully', async () => {
    // Logout with empty token
    const result = await logout('');

    // Should still return success
    expect(result.success).toBe(true);
  });

  it('should delete only the specified token session', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        is_active: true,
        email_verified: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create multiple sessions for the same user
    await db.insert(sessionsTable)
      .values([
        {
          user_id: user.id,
          token: 'token_to_delete',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        {
          user_id: user.id,
          token: 'token_to_keep',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ])
      .execute();

    // Logout with one specific token
    const result = await logout('token_to_delete');

    expect(result.success).toBe(true);

    // Verify only the specified session was deleted
    const deletedSession = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, 'token_to_delete'))
      .execute();

    const remainingSession = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, 'token_to_keep'))
      .execute();

    expect(deletedSession).toHaveLength(0);
    expect(remainingSession).toHaveLength(1);
    expect(remainingSession[0].token).toBe('token_to_keep');
  });

  it('should handle expired tokens correctly', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        is_active: true,
        email_verified: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create an expired session
    await db.insert(sessionsTable)
      .values({
        user_id: user.id,
        token: 'expired_token',
        expires_at: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      })
      .execute();

    // Logout with expired token
    const result = await logout('expired_token');

    expect(result.success).toBe(true);

    // Verify expired session was still deleted
    const remainingSessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, 'expired_token'))
      .execute();

    expect(remainingSessions).toHaveLength(0);
  });
});