"use client";

import { useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";

type PostImage = { id: string; url: string };

export function ImageViewerModal({
  images,
  initialIndex,
  open,
  onOpenChange,
}: {
  images: PostImage[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  // Reset to whichever thumbnail was tapped each time the viewer (re)opens -
  // during render, not an effect (see CreateNewsSheet.tsx for why).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(initialIndex);
  }

  function close() {
    onOpenChange(false);
  }

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-white transition-transform active:scale-90"
          >
            <X size={22} />
          </button>

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={images[index].id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative h-[70dvh] w-full max-w-[430px]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image src={images[index].url} alt="" fill sizes="430px" className="object-contain" />
            </motion.div>
          </AnimatePresence>

          {images.length > 1 && (
            <>
              {index > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => i - 1);
                  }}
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-transform active:scale-90"
                >
                  <CaretLeft size={20} />
                </button>
              )}
              {index < images.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => i + 1);
                  }}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-transform active:scale-90"
                >
                  <CaretRight size={20} />
                </button>
              )}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/70">
                {index + 1} / {images.length}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
