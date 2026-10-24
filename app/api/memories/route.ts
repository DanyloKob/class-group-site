import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canPostMemories } from "@/lib/permissions";
import { getMemoriesFeed } from "@/lib/server/memories";
import { processImage, saveProcessedImage } from "@/lib/uploads";
import { logAudit } from "@/lib/server/audit";
import { sendPushToCategory } from "@/lib/server/push";

const MAX_MEMORY_IMAGES = 10;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  const result = await getMemoriesFeed(user.id, cursor);

  return NextResponse.json({ ...result, canPost: canPostMemories(user) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // canPostMemories is the sole gate - no role bypass, even for SUPERADMIN.
  if (!canPostMemories(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const body = formData.get("body")?.toString().trim() || null;
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (!body && files.length === 0) {
    return NextResponse.json({ error: "empty_post" }, { status: 400 });
  }
  if (files.length > MAX_MEMORY_IMAGES) {
    return NextResponse.json({ error: "too_many_images", max: MAX_MEMORY_IMAGES }, { status: 400 });
  }

  // Validate (and re-encode) every file in memory before writing any of them
  // to disk, so one bad file in a multi-photo post can't leave earlier ones
  // orphaned.
  const processed = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processImage(buffer);
    if (!result) {
      return NextResponse.json({ error: "invalid_image", filename: file.name }, { status: 400 });
    }
    processed.push(result);
  }

  const saved = await Promise.all(processed.map((image) => saveProcessedImage(image, "memories")));

  const post = await prisma.memoryPost.create({
    data: {
      authorId: user.id,
      body,
      images: { create: saved.map((image, order) => ({ ...image, order })) },
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      images: { orderBy: { order: "asc" } },
    },
  });
  await logAudit(user.id, "CREATE", "MemoryPost", body || `Фото-пост (${saved.length} фото)`);
  sendPushToCategory(
    "notifyMemories",
    { title: "Нове у Спогадах", body: body || `${user.firstName} додав(ла) фото`, url: "/memories" },
    user.id,
  ).catch(() => {});

  return NextResponse.json({ post }, { status: 201 });
}
