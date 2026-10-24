import "server-only";
import { prisma } from "@/lib/db";
import { sortByNearestDate } from "@/lib/sortByNearestDate";

export async function getNewsFeed(currentUser: { id: string }) {
  const rows = await prisma.newsPost.findMany({
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      likes: { where: { userId: currentUser.id }, select: { userId: true } },
      _count: { select: { likes: true } },
    },
  });

  const shaped = rows.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    eventAt: post.eventAt,
    isPinned: post.isPinned,
    createdAt: post.createdAt,
    createdBy: post.createdBy,
    likeCount: post._count.likes,
    likedByMe: post.likes.length > 0,
  }));

  // Pinned posts (standing reference info, e.g. "textbooks for the year")
  // never mix into the date-ordered stream - newest-pinned-first, since
  // there's no eventAt to sort them by in the first place.
  const pinned = shaped
    .filter((p) => p.isPinned)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const posts = sortByNearestDate(
    shaped.filter((p) => !p.isPinned),
    (p) => p.eventAt,
    (p) => p.createdAt,
  );

  return { pinned, posts };
}

export type NewsFeedItem = Awaited<ReturnType<typeof getNewsFeed>>["posts"][number];
