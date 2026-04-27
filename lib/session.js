import crypto from 'crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'priorityos_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getKey() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error('APP_SESSION_SECRET is required. Add it to your Vercel environment variables.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encode(input) {
  return Buffer.from(input).toString('base64url');
}

function decode(input) {
  return Buffer.from(input, 'base64url');
}

export function encryptSession(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ ...payload, iat: Date.now() }), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [encode(iv), encode(tag), encode(encrypted)].join('.');
}

export function decryptSession(value) {
  if (!value) return null;
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), decode(ivRaw));
    decipher.setAuthTag(decode(tagRaw));
    const decrypted = Buffer.concat([
      decipher.update(decode(encryptedRaw)),
      decipher.final()
    ]).toString('utf8');
    return JSON.parse(decrypted);
  } catch (_error) {
    return null;
  }
}

export function getSession() {
  const jar = cookies();
  return decryptSession(jar.get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response, session) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: encryptSession(session),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(response) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}
