import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.memoryPostLike.upsert({
    where: { userId_memoryPostId: { userId: user.id, memoryPostId: id } },
    create: { userId: user.id, memoryPostId: id },
    update: {},
  });

  return NextResponse.json({ liked: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  await prisma.memoryPostLike.deleteMany({ where: { userId: user.id, memoryPostId: id } });

  return NextResponse.json({ liked: false });
}
