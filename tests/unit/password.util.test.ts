import crypto from 'crypto';
import { hashPassword, verifyPassword, isLegacyHash } from '../../src/utils/password.util';

/** Reproduces the old PBKDF2 `salt:hash` format that pre-bcrypt accounts use. */
const makeLegacyHash = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

describe('password.util', () => {
  const plainText = 'MySecureP@ssw0rd!';

  it('should hash a password', async () => {
    const hash = await hashPassword(plainText);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainText);
    expect(hash.startsWith('$2b$')).toBe(true); // bcrypt format
  });

  it('should verify a correct password against its hash', async () => {
    const hash = await hashPassword(plainText);
    const isValid = await verifyPassword(plainText, hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword(plainText);
    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should produce a unique hash each time', async () => {
    const hash1 = await hashPassword(plainText);
    const hash2 = await hashPassword(plainText);
    expect(hash1).not.toBe(hash2);
  });

  describe('legacy PBKDF2 hashes', () => {
    it('should verify a correct password against a legacy hash', async () => {
      const legacy = makeLegacyHash(plainText);
      await expect(verifyPassword(plainText, legacy)).resolves.toBe(true);
    });

    it('should reject an incorrect password against a legacy hash', async () => {
      const legacy = makeLegacyHash(plainText);
      await expect(verifyPassword('WrongPassword', legacy)).resolves.toBe(false);
    });

    it('should identify legacy hashes so callers can re-hash them', async () => {
      expect(isLegacyHash(makeLegacyHash(plainText))).toBe(true);
      expect(isLegacyHash(await hashPassword(plainText))).toBe(false);
    });

    it('should reject a malformed legacy hash instead of throwing', async () => {
      await expect(verifyPassword(plainText, 'no-salt-separator-here:')).resolves.toBe(false);
    });
  });
});
