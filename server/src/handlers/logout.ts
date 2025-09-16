import { db } from '../db';
import { sessionsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function logout(token: string): Promise<{ success: boolean }> {
  try {
    // Find and delete the session record
    const result = await db.delete(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .execute();

    // Return success regardless of whether token was found
    // This prevents timing attacks and provides consistent behavior
    return { success: true };
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
}