import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type DashboardData } from '../schema';
import { eq, and, count, desc, gte } from 'drizzle-orm';

export async function getDashboardData(token: string): Promise<DashboardData> {
  try {
    // Find the valid session with the user data
    const sessionResult = await db.select({
      user_id: sessionsTable.user_id,
      expires_at: sessionsTable.expires_at,
      user_email: usersTable.email,
      user_first_name: usersTable.first_name,
      user_last_name: usersTable.last_name,
      user_role: usersTable.role,
      user_is_active: usersTable.is_active,
      user_email_verified: usersTable.email_verified,
      user_created_at: usersTable.created_at,
      user_updated_at: usersTable.updated_at,
      user_id_field: usersTable.id
    })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(sessionsTable.user_id, usersTable.id))
      .where(
        and(
          eq(sessionsTable.token, token),
          gte(sessionsTable.expires_at, new Date()) // Check token hasn't expired
        )
      )
      .limit(1)
      .execute();

    if (sessionResult.length === 0) {
      throw new Error('Invalid or expired token');
    }

    const sessionData = sessionResult[0];

    // Get session statistics for the user
    const sessionStats = await db.select({
      total_logins: count(),
    })
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, sessionData.user_id))
      .execute();

    // Get the most recent login (excluding current session)
    const lastLoginResult = await db.select({
      created_at: sessionsTable.created_at
    })
      .from(sessionsTable)
      .where(eq(sessionsTable.user_id, sessionData.user_id))
      .orderBy(desc(sessionsTable.created_at))
      .limit(2) // Get 2 to exclude current session
      .execute();

    // Determine last login (second most recent if available, otherwise null)
    const lastLogin = lastLoginResult.length > 1 
      ? lastLoginResult[1].created_at 
      : null;

    return {
      user: {
        id: sessionData.user_id_field,
        email: sessionData.user_email,
        first_name: sessionData.user_first_name,
        last_name: sessionData.user_last_name,
        role: sessionData.user_role,
        is_active: sessionData.user_is_active,
        email_verified: sessionData.user_email_verified,
        created_at: sessionData.user_created_at,
        updated_at: sessionData.user_updated_at
      },
      stats: {
        total_logins: sessionStats[0].total_logins,
        last_login: lastLogin,
        account_created: sessionData.user_created_at
      }
    };
  } catch (error) {
    console.error('Dashboard data retrieval failed:', error);
    throw error;
  }
}