"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageViewerModal } from "@/app/(app)/memories/_components/ImageViewerModal";

type PostImage = { id: string; url: string; width: number | null; height: number | null };

export function ImageCarousel({ images }: { images: PostImage[] }) {
  // viewerIndex is never cleared on close (only replaced by the next thumb
  // tapped) so ImageViewerModal stays mounted and its close animation has
  // real content to animate away instead of unmounting blank.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (images.length === 0) return null;

  const visible = images.slice(0, 4);
  const extraCount = images.length - visible.length;

  return (
    <>
      <div className={`grid gap-1 overflow-hidden rounded-xl ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {visible.map((image, i) => {
          const isLastTile = i === visible.length - 1 && extraCount > 0;
          const spanFull = images.length === 3 && i === 0;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                setViewerIndex(i);
                setViewerOpen(true);
              }}
              className={`relative aspect-square overflow-hidden bg-surface-elevated transition-opacity active:opacity-75 ${spanFull ? "col-span-2 aspect-[2/1]" : ""}`}
            >
              <Image src={image.url} alt="" fill sizes="430px" className="object-cover" />
              {isLastTile && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-medium text-white">
                  +{extraCount}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {viewerIndex !== null && (
        <ImageViewerModal images={images} initialIndex={viewerIndex} open={viewerOpen} onOpenChange={setViewerOpen} />
      )}
    </>
  );
}
