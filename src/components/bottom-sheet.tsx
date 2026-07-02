"use client";

import { useEffect, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

export function BottomSheet({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-overlay"
            aria-label="关闭弹层"
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: reduceMotion ? 0 : 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : 24, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
            className="relative z-10 flex max-h-[80vh] w-full max-w-[var(--app-max-width)] flex-col rounded-t-sheet bg-surface px-5 pb-[calc(var(--safe-bottom)+20px)] pt-3 shadow-sheet"
          >
            <span aria-hidden="true" className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-line" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-xl font-semibold text-ink">
                {title}
              </h2>
              <button
                type="button"
                aria-label="关闭"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
                onClick={onClose}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto pr-1 text-text">{children}</div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
