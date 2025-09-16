import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { getDashboardData } from '../handlers/get_dashboard_data';
import { eq } from 'drizzle-orm';

describe('getDashboardData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUser = {
    email: 'test@example.com',
    password_hash: 'hashed_password',
    first_name: 'John',
    last_name: 'Doe',
    role: 'user' as const,
    is_active: true,
    email_verified: true
  };

  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    return result[0];
  };

  const createValidSession = async (userId: number, token = 'valid_token') => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1); // 1 hour from now

    const result = await db.insert(sessionsTable)
      .values({
        user_id: userId,
        token,
        expires_at: futureDate
      })
      .returning()
      .execute();
    return result[0];
  };

  const createExpiredSession = async (userId: number, token = 'expired_token') => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago

    const result = await db.insert(sessionsTable)
      .values({
        user_id: userId,
        token,
        expires_at: pastDate
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should return dashboard data for valid token', async () => {
    const user = await createTestUser();
    const session = await createValidSession(user.id);

    const result = await getDashboardData(session.token);

    // Verify user data
    expect(result.user.id).toEqual(user.id);
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.first_name).toEqual(testUser.first_name);
    expect(result.user.last_name).toEqual(testUser.last_name);
    expect(result.user.role).toEqual(testUser.role);
    expect(result.user.is_active).toEqual(testUser.is_active);
    expect(result.user.email_verified).toEqual(testUser.email_verified);
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Verify stats data
    expect(result.stats.total_logins).toEqual(1);
    expect(result.stats.last_login).toBeNull(); // No previous login
    expect(result.stats.account_created).toBeInstanceOf(Date);
    expect(result.stats.account_created).toEqual(user.created_at);
  });

  it('should track multiple logins correctly', async () => {
    const user = await createTestUser();
    
    // Create multiple sessions for the same user
    await createValidSession(user.id, 'token1');
    await createValidSession(user.id, 'token2');
    const currentSession = await createValidSession(user.id, 'token3');

    const result = await getDashboardData(currentSession.token);

    // Should count all sessions as logins
    expect(result.stats.total_logins).toEqual(3);
    
    // Last login should be the second most recent session
    expect(result.stats.last_login).toBeInstanceOf(Date);
    expect(result.stats.last_login).not.toBeNull();
  });

  it('should handle admin users correctly', async () => {
    const adminUser = {
      ...testUser,
      email: 'admin@example.com',
      role: 'admin' as const
    };

    const user = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();
    
    const session = await createValidSession(user[0].id);

    const result = await getDashboardData(session.token);

    expect(result.user.role).toEqual('admin');
    expect(result.user.email).toEqual('admin@example.com');
  });

  it('should throw error for invalid token', async () => {
    await expect(getDashboardData('invalid_token'))
      .rejects.toThrow(/invalid or expired token/i);
  });

  it('should throw error for expired token', async () => {
    const user = await createTestUser();
    const expiredSession = await createExpiredSession(user.id);

    await expect(getDashboardData(expiredSession.token))
      .rejects.toThrow(/invalid or expired token/i);
  });

  it('should handle inactive users', async () => {
    const inactiveUser = {
      ...testUser,
      email: 'inactive@example.com',
      is_active: false
    };

    const user = await db.insert(usersTable)
      .values(inactiveUser)
      .returning()
      .execute();
    
    const session = await createValidSession(user[0].id);

    const result = await getDashboardData(session.token);

    expect(result.user.is_active).toEqual(false);
    expect(result.stats.total_logins).toEqual(1);
  });

  it('should handle unverified email users', async () => {
    const unverifiedUser = {
      ...testUser,
      email: 'unverified@example.com',
      email_verified: false
    };

    const user = await db.insert(usersTable)
      .values(unverifiedUser)
      .returning()
      .execute();
    
    const session = await createValidSession(user[0].id);

    const result = await getDashboardData(session.token);

    expect(result.user.email_verified).toEqual(false);
    expect(result.stats.total_logins).toEqual(1);
  });

  it('should correctly calculate login statistics across time', async () => {
    const user = await createTestUser();
    
    // Create sessions with different timestamps
    const pastDate1 = new Date();
    pastDate1.setHours(pastDate1.getHours() - 2);
    
    const pastDate2 = new Date();
    pastDate2.setHours(pastDate2.getHours() - 1);
    
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);

    // Insert sessions manually with specific timestamps
    await db.insert(sessionsTable).values({
      user_id: user.id,
      token: 'old_token1',
      expires_at: futureDate,
      created_at: pastDate1
    });

    await db.insert(sessionsTable).values({
      user_id: user.id,
      token: 'old_token2',
      expires_at: futureDate,
      created_at: pastDate2
    });

    const currentSession = await createValidSession(user.id, 'current_token');

    const result = await getDashboardData(currentSession.token);

    expect(result.stats.total_logins).toEqual(3);
    
    // Last login should be the second most recent (pastDate2)
    expect(result.stats.last_login).toBeInstanceOf(Date);
    expect(result.stats.last_login?.getTime()).toBeCloseTo(pastDate2.getTime(), -3); // Allow small time difference
  });
});