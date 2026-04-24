import crypto from "crypto";

// ── constants ──────────────────────────────────────────────────────────────
const COOKIE_NAME = "futbol-session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PBKDF2_ITER = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha256";

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET env variable is not set");
  return s;
}

// ── types ──────────────────────────────────────────────────────────────────
export type Role = "ADMIN" | "CAPTAIN";

export type SessionUser = {
  userId: string;
  username: string;
  role: Role;
  teamId: string | null;
};

// ── password hashing ───────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  if (computed.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
}

// ── token signing ──────────────────────────────────────────────────────────
function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function parseToken(token: string): SessionUser | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = sign(payload);
    // constant-time compare (both are 64-char hex strings from HMAC-SHA256)
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return {
      userId: data.userId,
      username: data.username,
      role: data.role,
      teamId: data.teamId ?? null,
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
