import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

const REQUEST_TTL_MS = 5 * 60 * 1000;

export type TelegramLoginLink = { token: string; deepLink: string };

export function isTelegramBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
}

/**
 * Mints a login request and its t.me deep link.
 *
 * The login page calls this while rendering, so the button is a real <a href>
 * with the link already in the HTML. That is the whole Safari fix: Safari
 * blocks window.open() once an await has ended the user-gesture context, and
 * the old flow could only build the link *after* POSTing for a token. A plain
 * anchor in a genuine tap is never popup-blocked, in Safari or in Telegram's
 * in-app browser.
 */
export async function createTelegramLoginRequest(meta: {
  ipAddress?: string | null;
  userAgent?: string | null;
  /** SHA-256 of the browser's login nonce cookie, see lib/auth/loginNonce.ts. */
  nonceHash: string;
}): Promise<TelegramLoginLink | null> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!isTelegramBotConfigured() || !botUsername) return null;

  // Telegram's /start payload only accepts [A-Za-z0-9_-]{1,64} — base64url, no padding.
  const token = randomBytes(24).toString("base64url").replace(/=+$/, "");

  await prisma.telegramLoginRequest.create({
    data: {
      token,
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      nonceHash: meta.nonceHash,
    },
  });

  // A token is now minted on every login-page view, not just on every button
  // press, so stale PENDING rows would pile up unbounded without this sweep.
  void prisma.telegramLoginRequest
    .deleteMany({ where: { status: "PENDING", expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } })
    .catch(() => {});

  return { token, deepLink: `https://t.me/${botUsername}?start=${token}` };
}
