import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

/**
 * HTTP cookies are scoped by hostname only, never by port - so localhost:8080,
 * :8090, and :8091 would otherwise all share one login. Production only ever
 * runs one instance on one real domain, so this suffix only kicks in for the
 * 3 concurrent local dev ports (see package.json's "dev" script, which sets
 * PORT explicitly for each), keeping each one's identity independent.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" || !process.env.PORT
    ? "l23_session"
    : `l23_session_${process.env.PORT}`;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });
  return rawToken;
}

/** Only callable from Route Handlers / Server Actions, not Server Components. */
export async function setSessionCookie(rawToken: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }
  return session.user;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
  }
  store.delete(SESSION_COOKIE);
}
