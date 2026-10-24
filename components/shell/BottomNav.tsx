"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardText,
  Megaphone,
  CalendarBlank,
  Images,
  User,
  type Icon,
} from "@phosphor-icons/react";

const NAV_ITEMS: { href: string; label: string; icon: Icon; iconFilled: Icon }[] = [
  { href: "/tasks", label: "Завдання", icon: ClipboardText, iconFilled: ClipboardText },
  { href: "/news", label: "Оголошення", icon: Megaphone, iconFilled: Megaphone },
  { href: "/schedule", label: "Розклад", icon: CalendarBlank, iconFilled: CalendarBlank },
  { href: "/memories", label: "Спогади", icon: Images, iconFilled: Images },
  { href: "/account", label: "Профіль", icon: User, iconFilled: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 items-stretch border-t border-border bg-surface/80 backdrop-blur-md">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const ItemIcon = active ? item.iconFilled : item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5"
          >
            {active && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-accent/12"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <ItemIcon
              size={24}
              weight={active ? "fill" : "regular"}
              className={`relative ${active ? "text-accent" : "text-ink-muted"}`}
            />
            <span className={`relative max-w-full truncate px-0.5 text-[11px] leading-none max-[340px]:text-[10px] ${active ? "text-accent font-medium" : "text-ink-muted"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
