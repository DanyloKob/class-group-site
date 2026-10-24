import "server-only";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 10;

export async function getMemoriesFeed(currentUserId: string, cursor?: string) {
  const posts = await prisma.memoryPost.findMany({
    take: PAGE_SIZE + 1,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      images: { orderBy: { order: "asc" } },
      likes: { where: { userId: currentUserId }, select: { userId: true } },
      _count: { select: { likes: true } },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = hasMore ? posts.slice(0, PAGE_SIZE) : posts;

  return {
    posts: page.map((post) => ({
      id: post.id,
      body: post.body,
      createdAt: post.createdAt,
      author: post.author,
      images: post.images,
      likeCount: post._count.likes,
      likedByMe: post.likes.length > 0,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export type MemoriesFeedItem = Awaited<ReturnType<typeof getMemoriesFeed>>["posts"][number];
