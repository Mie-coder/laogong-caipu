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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-apricot/30 glass-nav px-4 pb-4 pt-2">
      <div className="mx-auto grid max-w-[430px] grid-cols-2 gap-3 px-4">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-pill px-3 py-2 text-xs transition ${
                active ? "btn-primary text-white" : "text-muted"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
