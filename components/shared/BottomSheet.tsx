"use client";

import { Drawer } from "vaul";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-2xl bg-surface-elevated outline-none"
        >
          <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-border" />
          {title && <Drawer.Title className="px-5 pb-2 pt-3 text-base font-semibold">{title}</Drawer.Title>}
          <div className="flex-1 overflow-y-auto px-5 pb-8">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
