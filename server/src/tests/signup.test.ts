import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, sessionsTable } from '../db/schema';
import { type SignupInput } from '../schema';
import { signup } from '../handlers/signup';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: SignupInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe'
};

describe('signup', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new user and return auth response', async () => {
    const result = await signup(testInput);

    // Validate user data
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.first_name).toEqual('John');
    expect(result.user.last_name).toEqual('Doe');
    expect(result.user.role).toEqual('user');
    expect(result.user.is_active).toEqual(true);
    expect(result.user.email_verified).toEqual(false);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Validate token is generated
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should save user to database with hashed password', async () => {
    const result = await signup(testInput);

    // Query user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];

    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.role).toEqual('user');
    expect(savedUser.is_active).toEqual(true);
    expect(savedUser.email_verified).toEqual(false);

    // Password should be hashed, not plain text
    expect(savedUser.password_hash).not.toEqual('password123');
    expect(savedUser.password_hash.length).toBeGreaterThan(10);
  });

  it('should create session record with token', async () => {
    const result = await signup(testInput);

    // Query session from database
    const sessions = await db.select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, result.token))
      .execute();

    expect(sessions).toHaveLength(1);
    const session = sessions[0];

    expect(session.user_id).toEqual(result.user.id);
    expect(session.token).toEqual(result.token);
    expect(session.expires_at).toBeInstanceOf(Date);
    expect(session.created_at).toBeInstanceOf(Date);

    // Session should expire in the future (approximately 24 hours)
    const now = new Date();
    const timeDiff = session.expires_at.getTime() - now.getTime();
    const hoursUntilExpiry = timeDiff / (1000 * 60 * 60);
    expect(hoursUntilExpiry).toBeGreaterThan(23);
    expect(hoursUntilExpiry).toBeLessThan(25);
  });

  it('should throw error when email already exists', async () => {
    // Create first user
    await signup(testInput);

    // Try to create another user with same email
    const duplicateInput: SignupInput = {
      ...testInput,
      first_name: 'Jane',
      last_name: 'Smith'
    };

    await expect(signup(duplicateInput)).rejects.toThrow(/email already exists/i);
  });

  it('should generate unique tokens for different users', async () => {
    const firstResult = await signup(testInput);

    const secondInput: SignupInput = {
      email: 'test2@example.com',
      password: 'password456',
      first_name: 'Jane',
      last_name: 'Smith'
    };

    const secondResult = await signup(secondInput);

    // Tokens should be different
    expect(firstResult.token).not.toEqual(secondResult.token);
    expect(firstResult.token.length).toEqual(secondResult.token.length);
  });

  it('should hash passwords consistently but uniquely', async () => {
    const firstResult = await signup(testInput);

    // Create second user with same password
    const secondInput: SignupInput = {
      email: 'test2@example.com',
      password: 'password123', // Same password
      first_name: 'Jane',
      last_name: 'Smith'
    };

    const secondResult = await signup(secondInput);

    // Get both users from database
    const users = await db.select()
      .from(usersTable)
      .execute();

    expect(users).toHaveLength(2);

    const firstUser = users.find(u => u.id === firstResult.user.id);
    const secondUser = users.find(u => u.id === secondResult.user.id);

    expect(firstUser).toBeDefined();
    expect(secondUser).toBeDefined();

    // Same password should produce same hash (for this simple implementation)
    expect(firstUser!.password_hash).toEqual(secondUser!.password_hash);
    expect(firstUser!.password_hash).not.toEqual('password123');
  });

  it('should set correct default values', async () => {
    const result = await signup(testInput);

    // Check default values are applied correctly
    expect(result.user.role).toEqual('user');
    expect(result.user.is_active).toEqual(true);
    expect(result.user.email_verified).toEqual(false);

    // Verify in database as well
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    const savedUser = users[0];
    expect(savedUser.role).toEqual('user');
    expect(savedUser.is_active).toEqual(true);
    expect(savedUser.email_verified).toEqual(false);
  });
});