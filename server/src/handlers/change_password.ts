import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type ChangePasswordInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function changePassword(token: string, input: ChangePasswordInput): Promise<{ success: boolean }> {
  try {
    // 1. Validate the authentication token and find the associated user
    const sessionResults = await db.select({
      user_id: sessionsTable.user_id,
      expires_at: sessionsTable.expires_at
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .execute();

    if (sessionResults.length === 0) {
      throw new Error('Invalid or expired token');
    }

    const session = sessionResults[0];
    
    // Check if token is expired
    if (session.expires_at < new Date()) {
      throw new Error('Invalid or expired token');
    }

    // 2. Find the user and verify current password
    const userResults = await db.select({
      id: usersTable.id,
      password_hash: usersTable.password_hash
    })
    .from(usersTable)
    .where(eq(usersTable.id, session.user_id))
    .execute();

    if (userResults.length === 0) {
      throw new Error('User not found');
    }

    const user = userResults[0];

    // 3. Verify current password against stored hash
    const currentPasswordMatches = await Bun.password.verify(input.current_password, user.password_hash);
    if (!currentPasswordMatches) {
      throw new Error('Current password is incorrect');
    }

    // 4. Hash the new password securely
    const newPasswordHash = await Bun.password.hash(input.new_password);

    // 5. Update the user's password_hash
    await db.update(usersTable)
      .set({ 
        password_hash: newPasswordHash,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, user.id))
      .execute();

    // 6. Invalidate all existing sessions for security
    await db.delete(sessionsTable)
      .where(eq(sessionsTable.user_id, user.id))
      .execute();

    // 7. Return success status
    return { success: true };
  } catch (error) {
    console.error('Password change failed:', error);
    throw error;
  }
}