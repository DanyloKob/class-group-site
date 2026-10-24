import { NextResponse } from "next/server";
import { createTelegramLoginRequest } from "@/lib/server/telegramLogin";

export async function POST(request: Request) {
  const link = await createTelegramLoginRequest({
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  if (!link) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });
  }

  return NextResponse.json(link);
}
