import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canLikeHomework } from "@/lib/schedule/permissions";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const homework = await prisma.homework.findUnique({ where: { id } });
  if (!homework) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Likes drive the sort order here, so self-liking to game rank is blocked
  // (unlike News/Memories, which have no competitive sort).
  if (!canLikeHomework(user, homework)) {
    return NextResponse.json({ error: "cannot_like_own" }, { status: 403 });
  }

  await prisma.homeworkLike.upsert({
    where: { userId_homeworkId: { userId: user.id, homeworkId: id } },
    create: { userId: user.id, homeworkId: id },
    update: {},
  });

  return NextResponse.json({ liked: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.homeworkLike.deleteMany({ where: { userId: user.id, homeworkId: id } });
  return NextResponse.json({ liked: false });
}
