import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDevLoginEnabled } from "@/lib/auth/dev-login";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/auth/phone";

/**
 * Hit by the root page when DEV_LOGIN_AUTO_PHONE is set (ports 8080/8090) and
 * there's no session yet — signs straight in as the seeded user with that
 * phone number, so those ports never show the guest screen during local dev.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const autoPhone = process.env.DEV_LOGIN_AUTO_PHONE;

  if (!isDevLoginEnabled() || !autoPhone) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const user = await prisma.user.findFirst({
    where: { phone: normalizePhone(autoPhone) },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const rawToken = await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ipAddress: request.headers.get("x-forwarded-for"),
  });
  await setSessionCookie(rawToken);

  return NextResponse.redirect(new URL("/", url));
}
