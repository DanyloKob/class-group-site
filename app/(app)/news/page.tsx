import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getNewsFeed } from "@/lib/server/news";
import { canManageNews } from "@/lib/permissions";
import { NewsFeed } from "@/app/(app)/news/_components/NewsFeed";

export default async function NewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const feed = await getNewsFeed(user);

  return <NewsFeed initialPinned={feed.pinned} initialPosts={feed.posts} canCreate={canManageNews(user)} />;
}
