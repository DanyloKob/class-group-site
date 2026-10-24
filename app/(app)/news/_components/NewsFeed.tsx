"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Megaphone, PushPin } from "@phosphor-icons/react";
import { NewsCard } from "@/app/(app)/news/_components/NewsCard";
import { CreateNewsSheet } from "@/app/(app)/news/_components/CreateNewsSheet";
import type { NewsFeedItem } from "@/lib/server/news";

export function NewsFeed({
  initialPinned,
  initialPosts,
  canCreate,
}: {
  initialPinned: NewsFeedItem[];
  initialPosts: NewsFeedItem[];
  canCreate: boolean;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [posts, setPosts] = useState(initialPosts);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsFeedItem | null>(null);

  async function refresh() {
    const res = await fetch("/api/news");
    if (res.ok) {
      const data = await res.json();
      setPinned(data.pinned);
      setPosts(data.posts);
    }
  }

  async function handleDelete(id: string) {
    setPinned((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/news/${id}`, { method: "DELETE" });
  }

  const isEmpty = pinned.length === 0 && posts.length === 0;

  function startEdit(post: NewsFeedItem) {
    setEditingPost(post);
    setSheetOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-xl font-semibold tracking-tight">Оголошення</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setSheetOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-background transition-transform active:scale-90"
          >
            <Plus size={18} weight="bold" />
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Megaphone size={32} className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Оголошень поки немає.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 overflow-y-auto px-5 pb-6">
          {pinned.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <PushPin size={13} weight="fill" />
                Закріплено
              </div>
              <AnimatePresence initial={false}>
                {pinned.map((post) => (
                  <NewsCard
                    key={post.id}
                    post={post}
                    pinned
                    canManage={canCreate}
                    onEdit={() => startEdit(post)}
                    onDelete={() => handleDelete(post.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {posts.length > 0 && (
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {posts.map((post) => (
                  <NewsCard
                    key={post.id}
                    post={post}
                    canManage={canCreate}
                    onEdit={() => startEdit(post)}
                    onDelete={() => handleDelete(post.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <CreateNewsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingPost={editingPost}
        onSaved={refresh}
      />
    </div>
  );
}
