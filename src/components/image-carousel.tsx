"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";

export function ImageCarousel({
  images,
  showDelete,
  onDelete
}: {
  images: string[];
  showDelete?: boolean;
  onDelete?: (url: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const filtered = images.filter(Boolean);
  if (!filtered.length) return null;

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i === 0 ? filtered.length - 1 : i - 1)); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIndex((i) => (i === filtered.length - 1 ? 0 : i + 1)); };

  return (
    <>
      <div className="relative overflow-hidden rounded-card bg-apricot/30 cursor-pointer" onClick={() => setFullscreen(true)}>
        <div className="relative aspect-[4/3]">
          <AnimatePresence mode="wait">
            <motion.img
              key={filtered[index]}
              src={filtered[index]}
              alt={`图片 ${index + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </AnimatePresence>
        </div>
        {filtered.length > 1 ? (
          <>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow-soft" onClick={prev}>
              <ChevronLeft className="h-5 w-5 text-ink" />
            </button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow-soft" onClick={next}>
              <ChevronRight className="h-5 w-5 text-ink" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {filtered.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-coral" : "w-1.5 bg-white/70"}`} />
              ))}
            </div>
            <span className="absolute right-2 top-2 rounded-pill bg-black/40 px-2 py-0.5 text-xs text-white">
              {index + 1}/{filtered.length}
            </span>
          </>
        ) : null}
        {showDelete && onDelete ? (
          <button
            className="absolute left-2 top-2 z-10 rounded-full bg-red-500/80 p-1.5"
            onClick={(e) => { e.stopPropagation(); onDelete(filtered[index]); }}
          >
            <Trash2 className="h-4 w-4 text-white" />
          </button>
        ) : null}
      </div>

      {showDelete ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((url, i) => (
            <div
              key={url}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-card ${i === index ? "ring-2 ring-coral" : ""}`}
              onClick={() => setIndex(i)}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setFullscreen(false)}
          >
            <button className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2" onClick={() => setFullscreen(false)}>
              <X className="h-6 w-6 text-white" />
            </button>
            {filtered.length > 1 ? (
              <button className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2" onClick={prev}>
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
            ) : null}
            <AnimatePresence mode="wait">
              <motion.img
                key={filtered[index]}
                src={filtered[index]}
                alt=""
                className="max-h-[90vh] max-w-[95vw] object-contain"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
              />
            </AnimatePresence>
            {filtered.length > 1 ? (
              <button className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2" onClick={next}>
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            ) : null}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {filtered.map((_, i) => (
                <span key={i} className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-coral" : "w-2 bg-white/40"}`} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
