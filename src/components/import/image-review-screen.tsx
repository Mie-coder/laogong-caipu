"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "@/components/image-carousel";

type ImageReviewScreenProps = { urls: string[]; selectedUrls: string[]; coverUrl: string | null; onBack: () => void; onToggle: (url: string) => void; onCover: (url: string) => void; onConfirm: (withoutImages?: boolean) => void };
export function ImageReviewScreen({ urls, selectedUrls, coverUrl, onBack, onToggle, onCover, onConfirm }: ImageReviewScreenProps) {
  return <main data-testid="image-review-page" className="image-review-page mx-auto min-h-dvh max-w-[430px] pb-28">
    <header className="image-review-header"><Button variant="ghost" size="icon" aria-label="返回解析结果" onClick={onBack}><ChevronLeft /></Button><div><h1 className="image-review-title">审核图片</h1><p className="image-review-subtitle">已选择 {selectedUrls.length} 张</p></div></header>
    <div className="px-5 pt-4"><ImageCarousel images={urls} selectedUrls={selectedUrls} coverUrl={coverUrl} onToggleSelection={onToggle} onSetCover={onCover} variant="imageReview" /></div>
    <p className="image-review-all-count">所有解析图片 共 {urls.length} 张</p>
    <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[430px] gap-3 border-t bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"><Button variant="secondary" className="flex-1" onClick={() => onConfirm(true)}>无图保存</Button><Button className="flex-[2]" onClick={() => onConfirm()}>确认图片（{selectedUrls.length}）</Button></footer>
  </main>;
}
