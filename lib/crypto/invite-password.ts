import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM。
// v2 フォーマット: "enc:v2:" + base64( iv(12) || tag(16) || ciphertext )
// v1 フォーマット: "enc:" + base64(...)。AUTH_SECRET 派生鍵で保存していた旧形式。
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const LEGACY_PREFIX = "enc:";
const PREFIX = "enc:v2:";

const cachedKeys = new Map<string, Buffer>();

function deriveKey(secret: string, purpose: string): Buffer {
  const cacheKey = `${purpose}:${secret}`;
  const cachedKey = cachedKeys.get(cacheKey);
  if (cachedKey) return cachedKey;
  const key = createHash("sha256").update(secret).update(purpose).digest();
  cachedKeys.set(cacheKey, key);
  return key;
}

function getPrimaryKey(): Buffer {
  const secret = process.env.INVITE_PASSWORD_SECRET;
  if (!secret) {
    throw new Error("INVITE_PASSWORD_SECRET is required to encrypt invite passwords");
  }
  return deriveKey(secret, ":invite-password:v2");
}

function getLegacyKeys(): Buffer[] {
  const keys: Buffer[] = [];
  if (process.env.AUTH_SECRET) {
    keys.push(deriveKey(process.env.AUTH_SECRET, ":invite-password:v1"));
  }
  if (process.env.INVITE_PASSWORD_SECRET) {
    keys.push(getPrimaryKey());
  }
  return keys;
}

function decryptWithKey(stored: string, prefix: string, key: Buffer): string | null {
  try {
    const buf = Buffer.from(stored.slice(prefix.length), "base64");
    if (buf.length < IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function isEncryptedInvitePassword(stored: string): boolean {
  return stored.startsWith(PREFIX) || stored.startsWith(LEGACY_PREFIX);
}

export function encryptInvitePassword(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getPrimaryKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptInvitePassword(stored: string): string | null {
  if (!isEncryptedInvitePassword(stored)) return null;

  if (stored.startsWith(PREFIX)) {
    return decryptWithKey(stored, PREFIX, getPrimaryKey());
  }

  for (const key of getLegacyKeys()) {
    const decrypted = decryptWithKey(stored, LEGACY_PREFIX, key);
    if (decrypted !== null) return decrypted;
  }

  return null;
}
