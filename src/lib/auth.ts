import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.appSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function isPasswordSet(): Promise<boolean> {
  const hash = await getSetting('master_password_hash');
  return !!hash && hash.length > 0;
}

export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function calculateWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const plain = text.replace(/[#*_`~\[\](){}>|\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return 0;
  return plain.split(' ').length;
}

export async function verifyAuth(request: Request): Promise<boolean> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return false;
  const storedToken = await getSetting('session_token');
  return token === storedToken;
}