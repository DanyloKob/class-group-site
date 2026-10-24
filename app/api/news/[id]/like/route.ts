import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.newsLike.upsert({
    where: { userId_newsPostId: { userId: user.id, newsPostId: id } },
    create: { userId: user.id, newsPostId: id },
    update: {},
  });

  return NextResponse.json({ liked: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.newsLike.deleteMany({ where: { userId: user.id, newsPostId: id } });

  return NextResponse.json({ liked: false });
}
