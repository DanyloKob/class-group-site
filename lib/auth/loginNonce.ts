import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Binds a Telegram login to the browser that started it.
 *
 * Without this, whoever polls /api/auth/telegram/status/<token> gets the
 * session once the login is confirmed, so a leaked token (or a deep link
 * someone was tricked into opening) hands the session to a different browser.
 * The raw nonce lives only in this HttpOnly cookie; the login request stores
 * its SHA-256, and the status route mints a session only for a matching
 * cookie.
 *
 * The cookie is set by proxy.ts on the login page (the page mints its login
 * link during render, where cookies cannot be written) and by the /start
 * route when it mints a fresh link. Port-suffixed in local dev for the same
 * reason as the session cookie: cookies are scoped by host, not port.
 */
export const LOGIN_NONCE_COOKIE =
  process.env.NODE_ENV === "production" || !process.env.PORT
    ? "l23_login_nonce"
    : `l23_login_nonce_${process.env.PORT}`;

export const loginNonceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60,
};

export function newLoginNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLoginNonce(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function loginNonceMatches(raw: string | undefined, storedHash: string | null): boolean {
  if (!raw || !storedHash) return false;
  const presented = Buffer.from(hashLoginNonce(raw), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}
