import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { LOGIN_NONCE_COOKIE, loginNonceCookieOptions, loginNonceMatches } from "@/lib/auth/loginNonce";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const loginRequest = await prisma.telegramLoginRequest.findUnique({ where: { token } });
  if (!loginRequest) {
    return NextResponse.json({ status: "EXPIRED" });
  }

  // Only the browser that started this login may follow it. Knowing the token
  // is not enough: it travels in the t.me deep link, and a link someone else
  // started must never hand their browser the session of whoever confirmed it.
  if (!loginNonceMatches(request.cookies.get(LOGIN_NONCE_COOKIE)?.value, loginRequest.nonceHash)) {
    return NextResponse.json({ status: "FAILED", failureReason: "browser_mismatch" }, { status: 403 });
  }

  if (loginRequest.expiresAt < new Date() && loginRequest.status === "PENDING") {
    return NextResponse.json({ status: "EXPIRED" });
  }
  if (loginRequest.status !== "SUCCESS") {
    return NextResponse.json({ status: loginRequest.status, failureReason: loginRequest.failureReason });
  }

  // Atomic hand-off: only the poll that wins this conditional update mints the
  // session, so a racing duplicate poll can never create two sessions.
  const claimed = await prisma.telegramLoginRequest.updateMany({
    where: { token, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  if (claimed.count === 0 || !loginRequest.matchedUserId) {
    // Already consumed by an earlier poll (or, defensively, no matched user) —
    // the app should already be redirecting from that earlier response.
    return NextResponse.json({ status: "SUCCESS", alreadyConsumed: true });
  }

  const rawToken = await createSession(loginRequest.matchedUserId, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for"),
  });
  await setSessionCookie(rawToken);

  // Spent: the next login gets a fresh nonce from proxy.ts or /start. Set
  // through the same cookie store as the session cookie above.
  (await cookies()).set(LOGIN_NONCE_COOKIE, "", { ...loginNonceCookieOptions, maxAge: 0 });

  return NextResponse.json({ status: "SUCCESS" });
}
