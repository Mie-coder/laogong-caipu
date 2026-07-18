"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Image as ImageIcon, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageCarouselProps = { images: string[]; showDelete?: boolean; onDelete?: (url: string) => void; selectedUrls?: string[]; coverUrl?: string | null; onToggleSelection?: (url: string) => void; onSetCover?: (url: string) => void; variant?: "default" | "detailHero" | "imageReview" };

export function ImageCarousel({ images, showDelete, onDelete, selectedUrls, coverUrl, onToggleSelection, onSetCover, variant = "default" }: ImageCarouselProps) {
  const filtered = useMemo(() => [...new Set(images.filter(Boolean))], [images]);
  const [index, setIndex] = useState(0);
  const review = variant === "imageReview";
  useEffect(() => setIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0))), [filtered.length]);
  if (!filtered.length) return <div className={review ? "image-review-carousel" : "rounded-md border p-8 text-center text-muted-foreground"}><ImageIcon className="mx-auto" /><p className="mt-2 text-sm">当前没有可用图片</p></div>;
  const currentUrl = filtered[index];
  const selected = selectedUrls?.includes(currentUrl) ?? true;
  const previous = () => setIndex((current) => current === 0 ? filtered.length - 1 : current - 1);
  const next = () => setIndex((current) => current === filtered.length - 1 ? 0 : current + 1);
  const frameClass = variant === "detailHero" ? "recipe-detail-hero" : review ? "image-review-carousel" : "space-y-3";
  return <div className={frameClass} data-testid={review ? "image-review-carousel" : undefined}>
    <div className={variant === "detailHero" ? "recipe-detail-hero-frame" : review ? "image-review-main-frame" : "relative overflow-hidden rounded-lg"}>
      <img src={currentUrl} alt={`图片 ${index + 1}`} className={variant === "detailHero" ? "recipe-detail-hero-image" : review ? "image-review-main-image" : "aspect-square w-full object-cover"} />
      {filtered.length > 1 ? <><Button variant="secondary" size="icon" aria-label="上一张图片" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={previous}><ChevronLeft /></Button><Button variant="secondary" size="icon" aria-label="下一张图片" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={next}><ChevronRight /></Button></> : null}
    </div>
    {review ? <><div className="flex gap-2"><Button className="image-review-action flex-1" variant="secondary" onClick={() => onSetCover?.(currentUrl)}><Star />设为封面</Button><Button className="image-review-action flex-1" variant="secondary" onClick={() => onToggleSelection?.(currentUrl)}><Trash2 />{selected ? "取消选择" : "恢复选择"}</Button></div><div className="image-review-thumbnails" data-testid="image-review-thumbnails">{filtered.map((url, imageIndex) => { const isSelected = selectedUrls?.includes(url) ?? true; return <Button key={url} variant="ghost" aria-label={`预览第 ${imageIndex + 1} 张图片`} data-testid="image-review-thumbnail" className={`image-review-thumbnail ${isSelected ? "is-selected" : "is-muted"} ${coverUrl === url ? "is-cover" : ""}`} onClick={() => { setIndex(imageIndex); onToggleSelection?.(url); }}><img src={url} alt="" className="h-full w-full object-cover" />{isSelected ? <Check className="image-review-thumbnail-check" /> : null}</Button>; })}</div></> : null}
    {showDelete && onDelete ? <Button variant="ghost" onClick={() => onDelete(currentUrl)}>删除当前图片</Button> : null}
  </div>;
}
