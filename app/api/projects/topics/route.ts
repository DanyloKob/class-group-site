import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthApi } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/server/audit";

function parseDueDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 2020 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow like 2026-02-31, which Date.UTC silently rolls into March.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export async function POST(request: Request) {
  const auth = await requireAuthApi();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 120) return NextResponse.json({ error: "bad_title" }, { status: 400 });

  const dueDate = parseDueDate(body.dueDate);
  if (!dueDate) return NextResponse.json({ error: "bad_date" }, { status: 400 });

  let subject: string | null = null;
  if (body.subject !== undefined && body.subject !== null) {
    if (typeof body.subject !== "string") return NextResponse.json({ error: "bad_subject" }, { status: 400 });
    const trimmed = body.subject.trim();
    if (trimmed.length > 60) return NextResponse.json({ error: "bad_subject" }, { status: 400 });
    subject = trimmed || null;
  }

  const topic = await prisma.projectTopic.create({
    data: { title, subject, dueDate, createdById: auth.user.id },
    select: { id: true },
  });
  await logAudit(auth.user.id, "CREATE", "ProjectTopic", title);
  return NextResponse.json({ topic: { id: topic.id } }, { status: 201 });
}
