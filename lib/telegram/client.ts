import "server-only";
import { Api } from "grammy";

/**
 * Standalone Bot API client for one-off calls from the web process (e.g.
 * pulling a profile photo for the account page). The long-polling bot that
 * handles the login conversation is a separate process — see bot/index.ts —
 * so this never competes with it for updates.
 */
export function getTelegramApi(): Api | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return new Api(token);
}
