"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "@phosphor-icons/react";

type Feature = "news" | "memories" | "homework";

export function LikeButton({
  feature,
  id,
  initialLiked,
  initialCount,
  disabled,
  size = 16,
}: {
  feature: Feature;
  id: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
  size?: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending || disabled) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setPending(true);
    try {
      const res = await fetch(`/api/${feature}/${id}/like`, { method: nextLiked ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      aria-pressed={liked}
      className="flex min-h-10 items-center gap-1.5 py-2 disabled:opacity-40"
    >
      <motion.span whileTap={disabled ? undefined : { scale: 1.3 }} transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}>
        <Heart size={size} weight={liked ? "fill" : "regular"} className={liked ? "text-danger" : "text-ink-muted"} />
      </motion.span>
      <span className={`text-xs tabular-nums ${liked ? "text-danger" : "text-ink-muted"}`}>{count}</span>
    </button>
  );
}
