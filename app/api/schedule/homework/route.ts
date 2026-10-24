import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ClassGroupScope } from "@/lib/generated/prisma/enums";
import { parseDateParam } from "@/lib/schedule/parity";
import { logAudit } from "@/lib/server/audit";
import { sendPushToCategory } from "@/lib/server/push";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.number().int().min(1).max(4),
  scope: z.enum(ClassGroupScope),
  text: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const homework = await prisma.homework.create({
    data: {
      date: parseDateParam(parsed.data.date),
      slot: parsed.data.slot,
      scope: parsed.data.scope,
      text: parsed.data.text,
      authorId: user.id,
    },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  await logAudit(user.id, "CREATE", "Homework", homework.text);
  sendPushToCategory(
    "notifyHomework",
    { title: "Нове домашнє завдання", body: homework.text, url: "/schedule" },
    user.id,
  ).catch(() => {});

  return NextResponse.json({ homework }, { status: 201 });
}
