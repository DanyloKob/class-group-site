"use client";

import { motion } from "framer-motion";
import { CalendarBlank, PencilSimple, PushPin } from "@phosphor-icons/react";
import { LikeButton } from "@/components/shared/LikeButton";
import { DeleteConfirmButton } from "@/components/shared/DeleteConfirmButton";
import { formatEventDate } from "@/lib/formatDate";
import type { NewsFeedItem } from "@/lib/server/news";

export function NewsCard({
  post,
  pinned = false,
  canManage,
  onEdit,
  onDelete,
}: {
  post: NewsFeedItem;
  pinned?: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={`flex flex-col gap-2 rounded-2xl p-4 ${pinned ? "bg-surface-elevated" : "bg-surface"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-[15px] font-semibold leading-snug">{post.title}</h3>
        {pinned ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2 py-1 text-[11px] font-medium text-accent">
            <PushPin size={11} weight="fill" />
            Закріплено
          </span>
        ) : (
          post.eventAt && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-elevated px-2 py-1 text-[11px] text-ink-muted">
              <CalendarBlank size={12} />
              {formatEventDate(post.eventAt)}
            </span>
          )
        )}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">{post.body}</p>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-ink-muted">
          {post.createdBy.firstName} {post.createdBy.lastName}
        </span>
        <div className="flex items-center gap-3">
          <LikeButton feature="news" id={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount} />
          {canManage && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-90"
              >
                <PencilSimple size={14} />
              </button>
              <DeleteConfirmButton onConfirm={onDelete} label="" />
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
