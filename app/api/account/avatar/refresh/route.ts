import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";
import { getTelegramApi } from "@/lib/telegram/client";
import { prisma } from "@/lib/db";
import { UPLOADS_BASE_DIR } from "@/lib/uploadsDir";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!user.telegramUserId) {
    return NextResponse.json({ error: "not_linked_to_telegram" }, { status: 400 });
  }

  const api = getTelegramApi();
  if (!api) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });
  }

  const photos = await api.getUserProfilePhotos(Number(user.telegramUserId), { limit: 1 });
  if (photos.total_count === 0 || photos.photos.length === 0) {
    return NextResponse.json({ error: "no_photo" }, { status: 404 });
  }

  const sizes = photos.photos[0];
  const largest = sizes[sizes.length - 1];
  const file = await api.getFile(largest.file_id);
  if (!file.file_path) {
    return NextResponse.json({ error: "no_photo" }, { status: 404 });
  }

  const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    return NextResponse.json({ error: "download_failed" }, { status: 502 });
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  const uploadsDir = path.join(/* turbopackIgnore: true */ UPLOADS_BASE_DIR, "avatars");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, `${user.id}.jpg`), bytes);

  const avatarUrl = `/uploads/avatars/${user.id}.jpg?v=${Date.now()}`;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });

  return NextResponse.json({ avatarUrl });
}
