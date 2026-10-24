import "server-only";

/**
 * Double, independent gate: `next build` hardcodes NODE_ENV=production (this
 * alone is already unbypassable in a real prod build), and DEV_LOGIN_ENABLED
 * is a second, explicit layer of intent on top of it.
 */
export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true";
}
