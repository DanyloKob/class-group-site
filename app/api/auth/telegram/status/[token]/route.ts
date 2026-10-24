import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const loginRequest = await prisma.telegramLoginRequest.findUnique({ where: { token } });
  if (!loginRequest) {
    return NextResponse.json({ status: "EXPIRED" });
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

  return NextResponse.json({ status: "SUCCESS" });
}
