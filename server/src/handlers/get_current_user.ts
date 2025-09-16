import { db } from '../db';
import { sessionsTable, usersTable } from '../db/schema';
import { type PublicUser } from '../schema';
import { eq, and, gt } from 'drizzle-orm';

export async function getCurrentUser(token: string): Promise<PublicUser | null> {
  try {
    // Find the session with the provided token that hasn't expired
    const result = await db.select({
      user: usersTable,
      session: sessionsTable
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.user_id, usersTable.id))
    .where(
      and(
        eq(sessionsTable.token, token),
        gt(sessionsTable.expires_at, new Date()) // Session must not be expired
      )
    )
    .limit(1)
    .execute();

    // If no valid session found, return null
    if (result.length === 0) {
      return null;
    }

    const { user } = result[0];

    // Check if user account is active
    if (!user.is_active) {
      return null;
    }

    // Return public user info (excluding password_hash)
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      email_verified: user.email_verified,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    throw error;
  }
}