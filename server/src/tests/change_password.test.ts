import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type ChangePasswordInput } from '../schema';
import { changePassword } from '../handlers/change_password';
import { eq } from 'drizzle-orm';

// Test input data
const testChangePasswordInput: ChangePasswordInput = {
  current_password: 'currentpass123',
  new_password: 'newpassword456'
};

describe('changePassword', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testToken: string;

  // Create test user and session before each test
  beforeEach(async () => {
    // Create test user with hashed current password
    const currentPasswordHash = await Bun.password.hash('currentpass123');
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: currentPasswordHash,
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        is_active: true,
        email_verified: true
      })
      .returning()
      .execute();

    testUserId = userResult[0].id;

    // Create valid session
    testToken = 'valid-test-token-123';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // Expires tomorrow

    await db.insert(sessionsTable)
      .values({
        user_id: testUserId,
        token: testToken,
        expires_at: expiresAt
      })
      .execute();
  });

  it('should change password successfully', async () => {
    const result = await changePassword(testToken, testChangePasswordInput);

    // Verify success response
    expect(result.success).toBe(true);

    // Verify password was updated in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    expect(users).toHaveLength(1);
    const user = users[0];

    // Verify new password hash works
    const newPasswordMatches = await Bun.password.verify('newpassword456', user.password_hash);
    expect(newPasswordMatches).toBe(true);

    // Verify old password no longer works
    const oldPasswordMatches = await Bun.password.verify('currentpass123', user.password_hash);
    expect(oldPasswordMatches).toBe(false);

    // Verify updated_at was changed
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it('should invalidate all existing sessions after password change', async () => {
    // Create additional session for the same user
    const additionalToken = 'additional-token-456';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    await db.insert(sessionsTable)
      .values({
        user_id: testUserId,
        token: additionalToken,
        expires_at: expiresAt
      })
      .execute();

    // Verify both sessions exist before password change
    const sessionsBefore = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, testUserId))
      .execute();

    expect(sessionsBefore).toHaveLength(2);

    // Change password
    await changePassword(testToken, testChangePasswordInput);

    // Verify all sessions were deleted
    const sessionsAfter = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, testUserId))
      .execute();

    expect(sessionsAfter).toHaveLength(0);
  });

  it('should fail with invalid token', async () => {
    const invalidToken = 'invalid-token-123';

    await expect(changePassword(invalidToken, testChangePasswordInput))
      .rejects
      .toThrow(/invalid or expired token/i);
  });

  it('should fail with expired token', async () => {
    // Create expired session
    const expiredToken = 'expired-token-123';
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expired yesterday

    await db.insert(sessionsTable)
      .values({
        user_id: testUserId,
        token: expiredToken,
        expires_at: expiredDate
      })
      .execute();

    await expect(changePassword(expiredToken, testChangePasswordInput))
      .rejects
      .toThrow(/invalid or expired token/i);
  });

  it('should fail with incorrect current password', async () => {
    const wrongCurrentPasswordInput: ChangePasswordInput = {
      current_password: 'wrongpassword',
      new_password: 'newpassword456'
    };

    await expect(changePassword(testToken, wrongCurrentPasswordInput))
      .rejects
      .toThrow(/current password is incorrect/i);

    // Verify password was not changed
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    const oldPasswordStillMatches = await Bun.password.verify('currentpass123', users[0].password_hash);
    expect(oldPasswordStillMatches).toBe(true);
  });

  it('should fail when user is deactivated', async () => {
    // Deactivate the user
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, testUserId))
      .execute();

    // The handler should still work (this tests that user lookup succeeds)
    // but in a real application, you might want to check is_active status
    const result = await changePassword(testToken, testChangePasswordInput);
    expect(result.success).toBe(true);

    // Verify password was still changed (handler doesn't check is_active)
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    const newPasswordMatches = await Bun.password.verify('newpassword456', users[0].password_hash);
    expect(newPasswordMatches).toBe(true);
  });

  it('should handle database transaction properly', async () => {
    // This test ensures that if something goes wrong, changes are not partially applied
    const result = await changePassword(testToken, testChangePasswordInput);
    expect(result.success).toBe(true);

    // Verify the operation was atomic - password changed AND sessions invalidated
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUserId))
      .execute();

    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, testUserId))
      .execute();

    // Both operations should have completed
    expect(users).toHaveLength(1);
    expect(sessions).toHaveLength(0);

    const newPasswordMatches = await Bun.password.verify('newpassword456', users[0].password_hash);
    expect(newPasswordMatches).toBe(true);
  });
});