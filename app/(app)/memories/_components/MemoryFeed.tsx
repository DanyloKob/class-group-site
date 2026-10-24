"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Images } from "@phosphor-icons/react";
import { MemoryPostCard } from "@/app/(app)/memories/_components/MemoryPostCard";
import { ComposeMemorySheet } from "@/app/(app)/memories/_components/ComposeMemorySheet";
import type { MemoriesFeedItem } from "@/lib/server/memories";

export function MemoryFeed({
  initialPosts,
  initialNextCursor,
  canPost,
  currentUserId,
  currentUserIsSuperAdmin,
}: {
  initialPosts: MemoriesFeedItem[];
  initialNextCursor: string | null;
  canPost: boolean;
  currentUserId: string;
  currentUserIsSuperAdmin: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/memories?cursor=${cursor}`);
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.posts]);
      setCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }, [cursor, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  async function refresh() {
    const res = await fetch("/api/memories");
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts);
      setCursor(data.nextCursor);
    }
  }

  async function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-xl font-semibold tracking-tight">Спогади</h1>
        {canPost && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
          >
            <Plus size={18} weight="bold" />
          </button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Images size={32} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Спогадів поки немає.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-6">
          <AnimatePresence initial={false}>
            {posts.map((post) => (
              <MemoryPostCard
                key={post.id}
                post={post}
                canDelete={currentUserIsSuperAdmin || post.author.id === currentUserId}
                onDelete={() => handleDelete(post.id)}
              />
            ))}
          </AnimatePresence>
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && <p className="pb-4 text-center text-xs text-ink-muted">Завантаження...</p>}
        </div>
      )}

      <ComposeMemorySheet open={sheetOpen} onOpenChange={setSheetOpen} onPosted={refresh} />
    </div>
  );
}
