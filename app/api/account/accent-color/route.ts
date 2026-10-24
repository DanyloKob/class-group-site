import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isValidHexColor } from "@/lib/color";

export const ACCENT_COOKIE = "l23_accent";

const bodySchema = z.object({ accentColor: z.string().nullable() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success || (parsed.data.accentColor !== null && !isValidHexColor(parsed.data.accentColor))) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { accentColor } = parsed.data;

  const store = await cookies();
  if (accentColor) {
    store.set(ACCENT_COOKIE, accentColor, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    store.delete(ACCENT_COOKIE);
  }

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { accentColor } });
  }

  return NextResponse.json({ ok: true });
}
