"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Image as ImageIcon, X } from "lucide-react";

type ImageCarouselProps = {
  images: string[];
  showDelete?: boolean;
  onDelete?: (url: string) => void;
  selectedUrls?: string[];
  coverUrl?: string | null;
  onToggleSelection?: (url: string) => void;
  onSetCover?: (url: string) => void;
};

export function ImageCarousel({
  images,
  showDelete,
  onDelete,
  selectedUrls,
  coverUrl,
  onToggleSelection,
  onSetCover
}: ImageCarouselProps) {
  const reduceMotion = useReducedMotion();
  const filtered = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const reviewMode = Boolean(selectedUrls && onToggleSelection && onSetCover);

  function findNearestSelectedIndex(currentIndex: number, urls: string[]) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    filtered.forEach((url, candidateIndex) => {
      if (!urls.includes(url)) return;

      const distance = Math.abs(candidateIndex - currentIndex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = candidateIndex;
        return;
      }

      if (distance === bestDistance && candidateIndex > currentIndex && (bestIndex < 0 || bestIndex < currentIndex)) {
        bestIndex = candidateIndex;
      }
    });

    return bestIndex;
  }

  useEffect(() => {
    if (!filtered.length) {
      setIndex(0);
      return;
    }
    setIndex((current) => Math.min(current, filtered.length - 1));
  }, [filtered]);

  useEffect(() => {
    if (!reviewMode || !selectedUrls || !filtered.length) return;
    const currentUrl = filtered[index];
    if (selectedUrls.includes(currentUrl)) return;
    if (selectedUrls.length === 0) return;

    const nearestIndex = findNearestSelectedIndex(index, selectedUrls);
    if (nearestIndex >= 0) {
      setIndex(nearestIndex);
    }
  }, [filtered, index, reviewMode, selectedUrls]);

  if (!filtered.length) {
    if (reviewMode) {
      return (
        <div className="space-y-4">
          <div className="flex aspect-square items-center justify-center rounded-[6px] border border-line bg-white text-muted">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8" aria-hidden="true" />
              <p className="mt-2 text-sm">当前没有可用图片</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const currentUrl = filtered[index];
  const currentSelected = selectedUrls?.includes(currentUrl) ?? true;

  const prev = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setIndex((current) => (current === 0 ? filtered.length - 1 : current - 1));
  };

  const next = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setIndex((current) => (current === filtered.length - 1 ? 0 : current + 1));
  };

  return (
    <>
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[6px] bg-white" onClick={() => setFullscreen(true)}>
          <div className="aspect-square">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentUrl}
                src={currentUrl}
                alt={`图片 ${index + 1}`}
                className="h-full w-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              />
            </AnimatePresence>
          </div>
          {filtered.length > 1 && (
            <>
              <button type="button" aria-label="上一张图片" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white" onClick={prev}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="下一张图片" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white" onClick={next}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {reviewMode && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button type="button" className="min-h-[44px] text-sm font-semibold text-ink" onClick={() => onSetCover?.(currentUrl)}>
                设为封面
              </button>
              <button type="button" className="min-h-[44px] text-sm font-semibold text-ink" onClick={() => onToggleSelection?.(currentUrl)}>
                {currentSelected ? "取消选择" : "恢复选择"}
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {filtered.map((url, thumbnailIndex) => {
                const isSelected = selectedUrls?.includes(url) ?? true;
                const isCover = coverUrl === url;
                return (
                  <button
                    key={url}
                    type="button"
                    aria-label={`预览第 ${thumbnailIndex + 1} 张图片`}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[6px] border ${isSelected ? "border-accent" : "border-transparent opacity-45"}`}
                    onClick={() => setIndex(thumbnailIndex)}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {isSelected && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-accent">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    {isCover && <span className="absolute bottom-1 left-1 text-[12px] text-white">封面</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!reviewMode && showDelete && (
          <div className="flex flex-wrap gap-2">
            {filtered.map((url, thumbnailIndex) => (
              <button
                key={url}
                type="button"
                className={`h-14 w-14 overflow-hidden rounded-[6px] ${thumbnailIndex === index ? "border border-accent" : ""}`}
                onClick={() => setIndex(thumbnailIndex)}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {showDelete && onDelete && !reviewMode && (
          <button type="button" className="text-sm text-ink" onClick={() => onDelete(currentUrl)}>
            删除当前图片
          </button>
        )}

        {reviewMode && !currentSelected && (
          <p className="text-sm text-muted">这张图当前不会保存，想保留的话点一下上面的“恢复选择”。</p>
        )}
      </div>

      <AnimatePresence>
        {fullscreen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={() => setFullscreen(false)}
          >
            <button type="button" aria-label="关闭大图" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-white" onClick={() => setFullscreen(false)}>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            {filtered.length > 1 && (
              <button type="button" aria-label="上一张大图" className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white" onClick={prev}>
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
            <motion.img
              key={currentUrl}
              src={currentUrl}
              alt=""
              className="max-h-[90vh] max-w-[95vw] object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              onClick={(event) => event.stopPropagation()}
            />
            {filtered.length > 1 && (
              <button type="button" aria-label="下一张大图" className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-white" onClick={next}>
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
