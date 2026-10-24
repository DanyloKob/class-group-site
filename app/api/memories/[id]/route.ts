import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/server/audit";
import { UPLOADS_BASE_DIR } from "@/lib/uploadsDir";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const post = await prisma.memoryPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      images: { orderBy: { order: "asc" } },
      likes: { where: { userId: user.id }, select: { userId: true } },
      _count: { select: { likes: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    post: {
      id: post.id,
      body: post.body,
      createdAt: post.createdAt,
      author: post.author,
      images: post.images,
      likeCount: post._count.likes,
      likedByMe: post.likes.length > 0,
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  const post = await prisma.memoryPost.findUnique({
    where: { id },
    include: { images: true, author: { select: { firstName: true, lastName: true } } },
  });
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwnPost = post.authorId === user.id;
  if (!isOwnPost && !user.isSuperAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.memoryPost.delete({ where: { id } });

  // Prisma's cascade only removes the DB rows, never the physical files.
  // image.url is "/uploads/memories/xxx.jpg" - strip the leading segment
  // since UPLOADS_BASE_DIR already points at the "uploads" directory itself.
  await Promise.all(
    post.images.map((image) =>
      unlink(path.join(/* turbopackIgnore: true */ UPLOADS_BASE_DIR, image.url.replace(/^\/uploads\//, ""))).catch(() => {
        // File already gone or never existed - deletion still succeeds.
      }),
    ),
  );

  const description = post.body || `Фото-пост (${post.images.length} фото)`;
  const summary = isOwnPost ? description : `${description} (автор: ${post.author.firstName} ${post.author.lastName})`;
  await logAudit(user.id, "DELETE", "MemoryPost", summary);

  return NextResponse.json({ ok: true });
}
