"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PencilLine } from "lucide-react";

const items = [
  { href: "/", label: "导入", icon: PencilLine },
  { href: "/recipes", label: "菜谱", icon: BookOpen }
];

export function BottomNav() {
  const pathname = usePathname();
  const hideNav = /^\/recipes\/[^/]+$/.test(pathname);

  if (hideNav) return null;

  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <div className="bottom-nav-grid">
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
              className={`bottom-nav-item ${active ? "is-active" : ""}`}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
              <span aria-hidden="true" className="bottom-nav-indicator" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
