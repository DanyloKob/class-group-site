import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAuthApi } from "@/lib/auth/permissions";
import { canManageNews } from "@/lib/permissions";
import { getNewsFeed } from "@/lib/server/news";
import { logAudit } from "@/lib/server/audit";
import { sendPushToCategory } from "@/lib/server/push";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const feed = await getNewsFeed(user);
  return NextResponse.json({ ...feed, canCreate: canManageNews(user) });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  eventAt: z.string().datetime().nullable().optional(),
  isPinned: z.boolean().default(false),
});

export async function POST(request: Request) {
  const check = await requireAuthApi();
  if (check.error) return check.error;
  if (!canManageNews(check.user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const post = await prisma.newsPost.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      eventAt: parsed.data.eventAt ? new Date(parsed.data.eventAt) : null,
      isPinned: parsed.data.isPinned,
      createdById: check.user.id,
    },
  });
  await logAudit(check.user.id, "CREATE", "News", post.title);
  sendPushToCategory(
    "notifyNews",
    { title: parsed.data.isPinned ? "Нове закріплене" : "Нове оголошення", body: post.title, url: "/news" },
    check.user.id,
  ).catch(() => {});

  return NextResponse.json({ post }, { status: 201 });
}
