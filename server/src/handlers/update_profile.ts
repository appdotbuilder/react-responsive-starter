import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type UpdateProfileInput, type PublicUser } from '../schema';
import { eq, and, gte } from 'drizzle-orm';

export async function updateProfile(token: string, input: UpdateProfileInput): Promise<PublicUser> {
  try {
    // 1. Validate the authentication token and get user ID
    const sessionResult = await db.select()
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.user_id, usersTable.id))
      .where(
        and(
          eq(sessionsTable.token, token),
          gte(sessionsTable.expires_at, new Date())
        )
      )
      .execute();

    if (sessionResult.length === 0) {
      throw new Error('Invalid or expired token');
    }

    const { sessions: session, users: user } = sessionResult[0];

    // 2. Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.first_name !== undefined) {
      updateData.first_name = input.first_name;
    }

    if (input.last_name !== undefined) {
      updateData.last_name = input.last_name;
    }

    // 3. Update the user's profile
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, user.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    const updatedUser = result[0];

    // 4. Return updated user info (without sensitive data)
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      role: updatedUser.role,
      is_active: updatedUser.is_active,
      email_verified: updatedUser.email_verified,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at
    };
  } catch (error) {
    console.error('Profile update failed:', error);
    throw error;
  }
}