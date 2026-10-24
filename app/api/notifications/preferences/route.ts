import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";

const preferencesSchema = z.object({
  notifyTasks: z.boolean().optional(),
  notifyNews: z.boolean().optional(),
  notifyHomework: z.boolean().optional(),
  notifyMemories: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;

  const parsed = preferencesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  await prisma.user.update({ where: { id: check.user.id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}
