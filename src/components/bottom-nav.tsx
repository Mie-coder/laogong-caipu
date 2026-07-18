"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { appleSpring } from "@/lib/motion";
import { BookOpen, Download } from "lucide-react";
const items = [{ href: "/", label: "导入", icon: Download }, { href: "/recipes", label: "菜谱", icon: BookOpen }];
export function BottomNav() {
  const pathname = usePathname();
  const reduced = useReducedMotion() !== false;
  if (/^\/recipes\/[^/]+(?:\/cook)?$/.test(pathname)) return null;
  return <nav className="v3-bottom-nav" aria-label="底部导航"><div>{items.map(({ href, label, icon: Icon }) => { const active = href === "/recipes" ? pathname === "/recipes" || pathname === "/categories" : pathname === "/"; return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}><Icon aria-hidden="true" /><span>{label}</span>{active && <motion.div className="v3-bottom-nav-indicator" layoutId="v3-nav-active" transition={reduced ? { duration: 0.01 } : appleSpring} />}</Link>; })}</div></nav>;
}
