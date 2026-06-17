"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeDraft } from "@/lib/domain/recipe";
import { parseImportApi } from "@/lib/http/api-client";
import { saveRecipeWithImages, filterImages } from "@/lib/http/api-client";
import { RecipeConfirmForm } from "@/components/recipe-confirm-form";
import { BottomSheet } from "@/components/bottom-sheet";
import { ImageCarousel } from "@/components/image-carousel";
import { Toast } from "@/components/toast";

const example = "5分钟就可以搞定！超级下饭的丝瓜炒蛋 丝瓜炒蛋可以算... http://xhslink.com/o/smiaxnsR3c 复制后打开【小红书】查看笔记！";

export function ImportFlow() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [manualSupplement, setManualSupplement] = useState("");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [filteredImageUrls, setFilteredImageUrls] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [needsSupplement, setNeedsSupplement] = useState(false);
  const [toast, setToast] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [imagesConfirmed, setImagesConfirmed] = useState(false);

  async function parse() {
    setStatus("正在识别链接");
    setImagesConfirmed(false);
    try {
      setStatus("正在抓取内容");
      const result = await parseImportApi({ rawInput, manualSupplement });
      setStatus("正在整理成菜谱");
      setDraft(result.recipe);
      const rawImages = result.imageUrls || [];
      setAllImageUrls(rawImages);

      if (rawImages.length > 0) {
        setStatus("正在筛选图片");
        setFiltering(true);
        const filtered = await filterImages(rawImages, result.recipe.name);
        setFilteredImageUrls(filtered);
        setFiltering(false);
      } else {
        setFilteredImageUrls([]);
      }

      setNeedsSupplement(result.needsSupplement);
      setStatus("");
      setImportOpen(false);
    } catch (error) {
      setStatus("");
      setToast(error instanceof Error ? error.message : "解析失败");
    }
  }

  function removeImage(url: string) {
    setFilteredImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function save() {
    if (!draft) return;
    const finalDraft = { ...draft, coverImageUrl: filteredImageUrls[0] ?? null };
    const saved = await saveRecipeWithImages(finalDraft, filteredImageUrls);
    setToast("保存成功");
    window.setTimeout(() => router.push(`/recipes?new=${saved.id}`), 400);
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted">小红书菜谱导入</p>
        <h1 className="text-2xl font-semibold text-ink">老公菜谱</h1>
      </div>

      {!draft ? (
        <div className="space-y-4">
          <textarea
            className="min-h-48 w-full rounded-card glass-card border border-white/30 px-4 py-3 outline-none focus:border-coral/50"
            placeholder={example}
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
          />
          <button className="w-full rounded-pill btn-primary px-5 py-4 font-semibold text-white" onClick={parse} disabled={!rawInput || Boolean(status)}>
            {status || "开始抓取"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {filtering ? (
            <div className="rounded-card glass-card p-4 text-sm text-ink text-center">
              正在用 AI 筛选图片...
            </div>
          ) : null}
          {!filtering && filteredImageUrls.length > 0 && !imagesConfirmed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  AI 已筛选 {filteredImageUrls.length} 张图片（共 {allImageUrls.length} 张），可点击删除
                </p>
              </div>
              <ImageCarousel images={filteredImageUrls} showDelete={true} onDelete={removeImage} />
              <button className="w-full rounded-pill glass-card px-4 py-3 text-sm font-semibold text-ink" onClick={() => setImagesConfirmed(true)}>
                确认图片，继续编辑菜谱
              </button>
            </div>
          ) : null}
          {needsSupplement ? (
            <div className="rounded-card glass-card p-4 text-sm text-ink">
              内容有点少，可以补充原文后重新解析。
              <textarea className="mt-3 min-h-28 w-full rounded-card glass-card border border-white/30 px-4 py-3" value={manualSupplement} onChange={(event) => setManualSupplement(event.target.value)} />
              <button className="mt-3 rounded-pill btn-primary px-4 py-2 text-sm font-semibold text-white" onClick={parse}>重新解析</button>
            </div>
          ) : null}
          <RecipeConfirmForm draft={draft} imageUrls={imagesConfirmed ? filteredImageUrls : []} onChange={setDraft} />
          <button className="w-full rounded-pill btn-primary px-5 py-4 font-semibold text-white" onClick={save}>
            保存菜谱
          </button>
          <button className="w-full rounded-pill btn-ghost px-5 py-4 font-semibold text-coral" onClick={() => setImportOpen(true)}>
            重新导入
          </button>
        </div>
      )}

      <BottomSheet open={importOpen} title="粘贴小红书分享" onClose={() => setImportOpen(false)}>
        <div className="space-y-3">
          <textarea className="min-h-36 w-full rounded-card glass-card border border-white/30 px-4 py-3" placeholder={example} value={rawInput} onChange={(event) => setRawInput(event.target.value)} />
          <button className="w-full rounded-pill btn-primary px-5 py-4 font-semibold text-white" onClick={parse} disabled={!rawInput || Boolean(status)}>
            {status || "开始抓取"}
          </button>
        </div>
      </BottomSheet>

      <Toast message={toast} />
    </section>
  );
}
