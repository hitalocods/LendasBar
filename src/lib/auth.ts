import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const STAFF_SESSION_COOKIE = "lendas_staff_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_PREFIX = "pbkdf2";
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_DIGEST = "sha256";
const PBKDF2_KEY_LENGTH = 64;

export type StaffRole = "OWNER" | "MANAGER" | "KITCHEN" | "WAITER" | "STAFF";

export type StaffSession = {
  userId: string;
  restaurantId: string;
  role: StaffRole;
  name: string;
  email: string | null;
  exp: number;
};

const roleRank: Record<StaffRole, number> = {
  STAFF: 0,
  WAITER: 1,
  KITCHEN: 2,
  MANAGER: 3,
  OWNER: 4
};

function getAuthSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;

  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;

  if (process.env.NODE_ENV === "production") {
    // Avoid hard crashes in production if envs are missing.
    // Keep a stable fallback so existing sessions remain readable between requests.
    return "lendas-production-fallback-change-me";
  }

  return "lendas-dev-auth-secret";
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createStaffSessionToken(session: Omit<StaffSession, "exp">) {
  const payload: StaffSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  const serialized = base64UrlEncode(JSON.stringify(payload));
  return `${serialized}.${signPayload(serialized)}`;
}

export function readStaffSessionToken(token?: string | null) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  const providedSignature = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedSignature.length !== expectedSignatureBuffer.length) return null;
  if (!timingSafeEqual(providedSignature, expectedSignatureBuffer)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as StaffSession;

    if (!session.userId || !session.restaurantId || !session.role || !session.name || !session.exp) {
      return null;
    }

    if (session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getStaffSession() {
  const cookieStore = await cookies();
  return readStaffSessionToken(cookieStore.get(STAFF_SESSION_COOKIE)?.value);
}

export function hasRoleAccess(role: StaffRole, minimumRole: StaffRole) {
  return roleRank[role] >= roleRank[minimumRole];
}

export async function hasStaffAccess(minimumRole: StaffRole = "STAFF") {
  const session = await getStaffSession();
  return session ? hasRoleAccess(session.role, minimumRole) : false;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString("hex");
  return `${PASSWORD_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, iterationsString, salt, expectedHash] = storedHash.split("$");
  if (prefix !== PASSWORD_PREFIX || !iterationsString || !salt || !expectedHash) return false;

  const iterations = Number(iterationsString);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const actualHash = pbkdf2Sync(password, salt, iterations, expectedHash.length / 2, PBKDF2_DIGEST).toString("hex");
  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
