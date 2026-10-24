import { NextResponse, type NextRequest } from "next/server";
import { createTelegramLoginRequest } from "@/lib/server/telegramLogin";
import {
  LOGIN_NONCE_COOKIE,
  hashLoginNonce,
  loginNonceCookieOptions,
  newLoginNonce,
} from "@/lib/auth/loginNonce";

export async function POST(request: NextRequest) {
  // Reuse this browser's nonce when it has one, so a link refreshed here never
  // orphans a login that is still being polled under the same cookie.
  const nonce = request.cookies.get(LOGIN_NONCE_COOKIE)?.value || newLoginNonce();

  const link = await createTelegramLoginRequest({
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    nonceHash: hashLoginNonce(nonce),
  });

  if (!link) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });
  }

  const response = NextResponse.json(link);
  response.cookies.set(LOGIN_NONCE_COOKIE, nonce, loginNonceCookieOptions);
  return response;
}
