import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canPostMemories } from "@/lib/permissions";
import { getMemoriesFeed } from "@/lib/server/memories";
import { MemoryFeed } from "@/app/(app)/memories/_components/MemoryFeed";

export default async function MemoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { posts, nextCursor } = await getMemoriesFeed(user.id);

  return (
    <MemoryFeed
      initialPosts={posts}
      initialNextCursor={nextCursor}
      canPost={canPostMemories(user)}
      currentUserId={user.id}
      currentUserIsSuperAdmin={user.isSuperAdmin}
    />
  );
}
