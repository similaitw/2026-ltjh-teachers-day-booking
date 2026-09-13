import crypto from 'node:crypto';

const COOKIE_NAME = 'ltjh_admin';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(timestamp) {
  return crypto.createHmac('sha256', secret()).update(String(timestamp)).digest('base64url');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function verifyPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  return !!expected && safeEqual(password, expected);
}

export function createAdminCookie() {
  const timestamp = Math.floor(Date.now() / 1000);
  const token = `${timestamp}.${sign(timestamp)}`;
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearAdminCookie() {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export function isAdmin(req) {
  if (!secret()) return false;
  const cookie = String(req.headers.cookie || '');
  const pair = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return false;
  const token = pair.slice(COOKIE_NAME.length + 1);
  const [timestampText, signature] = token.split('.');
  const timestamp = Number(timestampText);
  if (!timestamp || !signature) return false;
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + 60 || now - timestamp > MAX_AGE_SECONDS) return false;
  return safeEqual(signature, sign(timestamp));
}
