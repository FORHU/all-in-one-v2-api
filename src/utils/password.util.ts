import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

// Parameters of the legacy PBKDF2 scheme. Kept only so existing logins still
// work — never used to create new hashes.
const LEGACY_ITERATIONS = 1000;
const LEGACY_KEYLEN = 64;
const LEGACY_DIGEST = 'sha512';

/**
 * Hash a plain-text password.
 * Usage: const hashed = await hashPassword(plainText);
 */
export const hashPassword = (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * True for hashes stored under the old PBKDF2 `salt:hash` format, which is far
 * too weak (1,000 iterations). Callers should re-hash these with bcrypt on the
 * next successful login.
 */
export const isLegacyHash = (hash: string): boolean => {
  return !hash.startsWith('$2') && hash.includes(':');
};

/**
 * Verify a legacy PBKDF2 `salt:hash` password using a timing-safe comparison.
 */
const verifyLegacyPassword = (password: string, stored: string): boolean => {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;

  const computed = crypto.pbkdf2Sync(password, salt, LEGACY_ITERATIONS, LEGACY_KEYLEN, LEGACY_DIGEST);
  const expected = Buffer.from(storedHash, 'hex');

  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
};

/**
 * Compare a plain-text password against a stored hash. Accepts both bcrypt
 * hashes and legacy PBKDF2 hashes.
 * Usage: const isValid = await verifyPassword(plain, hash);
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  if (isLegacyHash(hash)) return verifyLegacyPassword(password, hash);
  return bcrypt.compare(password, hash);
};
