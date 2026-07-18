"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function BottomSheet({
  open,
  title,
  children,
  onClose,
  variant = "default"
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  variant?: "default" | "review";
}) {
  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DrawerContent className={`bottom-sheet ${variant === "review" ? "bottom-sheet-review" : ""} mx-auto max-h-[78vh] w-full max-w-[var(--app-max-width)] border-0 bg-surface px-5 pb-[calc(var(--safe-bottom)+16px)] pt-2 shadow-sheet`}>
        <DrawerHeader className="bottom-sheet-header mb-5 flex-row items-start justify-between gap-3 p-0 text-left">
          <DrawerTitle className="bottom-sheet-title text-[20px] font-semibold leading-[1.4] text-ink">{title}</DrawerTitle>
          <Button type="button" variant="ghost" size="icon" aria-label="关闭" className="bottom-sheet-close text-ink" onClick={onClose}>
            <X className="bottom-sheet-close-icon h-5 w-5" aria-hidden="true" />
          </Button>
        </DrawerHeader>
        <div className="bottom-sheet-content overflow-y-auto pr-1 text-text">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
