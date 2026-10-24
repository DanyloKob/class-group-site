"use client";

import { motion } from "framer-motion";
import { LikeButton } from "@/components/shared/LikeButton";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";
import { ImageCarousel } from "@/app/(app)/memories/_components/ImageCarousel";
import { formatEventDate } from "@/lib/formatDate";
import type { MemoriesFeedItem } from "@/lib/server/memories";

export function MemoryPostCard({
  post,
  canDelete,
  onDelete,
}: {
  post: MemoriesFeedItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-medium text-ink-muted">
            {post.author.firstName[0]}
            {post.author.lastName[0]}
          </div>
          <div>
            <p className="text-xs font-medium">
              {post.author.firstName} {post.author.lastName}
            </p>
            <p className="text-[11px] text-ink-muted">{formatEventDate(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && <DeleteConfirmButton onConfirm={onDelete} label="" />}
      </div>

      {post.body && <p className="whitespace-pre-wrap break-words text-sm">{post.body}</p>}

      <ImageCarousel images={post.images} />

      <LikeButton feature="memories" id={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount} />
    </motion.article>
  );
}
