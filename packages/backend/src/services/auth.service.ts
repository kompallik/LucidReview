import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  password_hash: string | null;
}

export interface LoginResult extends UserRow {
  sessionId: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const row = await db('users').where({ email, active: true }).first();
  return row ?? null;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// ---- Session management ----

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours (matches JWT expiry)
  await db('sessions').insert({
    id: sessionId,
    user_id: userId,
    revoked: false,
    created_at: new Date(),
    expires_at: expiresAt,
  });
  return sessionId;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db('sessions').where({ id: sessionId }).update({ revoked: true });
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await db('sessions')
    .where({ id: sessionId, revoked: false })
    .where('expires_at', '>', new Date())
    .first();
  return !!session;
}

// For dev convenience: if a user has no password_hash set, accept any password
// and set the hash on first login. Remove this in production.
export async function loginUser(email: string, password: string): Promise<LoginResult | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  if (!user.password_hash) {
    // First login — set password
    const hash = await hashPassword(password);
    await db('users').where({ id: user.id }).update({ password_hash: hash });
    const sessionId = await createSession(user.id);
    return { ...user, sessionId };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const sessionId = await createSession(user.id);
  return { ...user, sessionId };
}
