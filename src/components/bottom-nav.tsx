"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PlusCircle } from "lucide-react";

const items = [
  { href: "/", label: "导入", icon: PlusCircle },
  { href: "/recipes", label: "菜谱", icon: BookOpen }
];

export function BottomNav() {
  const pathname = usePathname();
  const hideNav = /^\/recipes\/[^/]+$/.test(pathname);

  if (hideNav) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface" aria-label="底部导航">
      <div className="mx-auto grid max-w-[var(--app-max-width)] grid-cols-2 px-[var(--app-gutter)] pb-[calc(var(--safe-bottom)+8px)] pt-2">
        {items.map((item) => {
          const active =
            item.href === "/recipes"
              ? pathname === "/recipes" || pathname === "/categories"
              : pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[44px] flex-col items-center justify-center gap-1 px-3 pb-3 pt-2 text-[13px] transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
              <span
                aria-hidden="true"
                className={`absolute bottom-0 h-0.5 w-7 bg-accent transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
