"use client";

import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-ink/20" aria-label="关闭弹窗" onClick={onClose} />
          <motion.section
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[430px] rounded-t-[24px] glass-sheet p-5 shadow-lift"
          >
            <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
            {children}
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
