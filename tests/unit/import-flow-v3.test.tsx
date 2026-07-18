import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecipeDraft } from "@/lib/domain/recipe";
import {
  importFlowReducer,
  initialImportFlowState,
  type ImportFlowState
} from "@/components/import/import-flow-machine";
import { ImportSheet } from "@/components/import/import-sheet";
import { ParsingProgress } from "@/components/import/parsing-progress";
import { ImageReviewScreen } from "@/components/import/image-review-screen";
import { RecipeConfirmForm } from "@/components/recipe-confirm-form";
import { ImportFlow } from "@/components/import-flow";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), parseImportApi: vi.fn(), filterImages: vi.fn(), saveRecipeWithImages: vi.fn(), listRecipesApi: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/http/api-client", () => ({ parseImportApi: mocks.parseImportApi, filterImages: mocks.filterImages, saveRecipeWithImages: mocks.saveRecipeWithImages, listRecipesApi: mocks.listRecipesApi }));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return { useReducedMotion: () => false, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, motion: { div: forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => React.createElement("div", { ...props, ref }, children)) } };
});

const draft: RecipeDraft = {
  name: "丝瓜炒蛋",
  mainCategory: "家常菜",
  tags: [],
  ingredients: [],
  seasonings: [],
  steps: [{ order: 1, text: "炒熟" }],
  cookTimeMinutes: 10,
  difficulty: "easy",
  tips: "",
  confidence: 1,
  missingFields: [],
  coverImageUrl: null,
  imageUrls: []
};

function parsedState(): ImportFlowState {
  return importFlowReducer(initialImportFlowState, {
    type: "PARSE_SUCCEEDED",
    draft,
    imageUrls: ["https://images.example/a.jpg", "https://images.example/b.jpg"],
    selectedUrls: ["https://images.example/a.jpg"]
  });
}

describe("ImportFlow V3 reducer", () => {
  it("keeps typed input when the drawer is closed and reopened", () => {
    const state = importFlowReducer(initialImportFlowState, { type: "INPUT_CHANGED", rawInput: "分享文本" });
    expect(importFlowReducer(state, { type: "PARSE_CANCELLED" })).toMatchObject({ stage: "home", rawInput: "分享文本" });
  });

  it("moves through parse start and progress", () => {
    const started = importFlowReducer(initialImportFlowState, { type: "PARSE_STARTED" });
    expect(importFlowReducer(started, { type: "PARSE_STEP_CHANGED", step: 2 })).toMatchObject({ stage: "parsing", parsingStep: 2 });
  });

  it("returns parse failures to the drawer state with its input", () => {
    const failed = importFlowReducer(
      importFlowReducer({ ...initialImportFlowState, rawInput: "保留文本" }, { type: "PARSE_STARTED" }),
      { type: "PARSE_FAILED", message: "解析失败" }
    );
    expect(failed).toMatchObject({ stage: "home", rawInput: "保留文本", error: "解析失败" });
  });

  it("deduplicates selected images and removes a deselected cover", () => {
    const withCover = importFlowReducer(parsedState(), { type: "COVER_SELECTED", url: "https://images.example/a.jpg" });
    const removed = importFlowReducer(withCover, { type: "IMAGE_TOGGLED", url: "https://images.example/a.jpg" });
    expect(removed).toMatchObject({ selectedUrls: [], coverUrl: null });
  });

  it("selecting a cover also selects it without duplicate URLs", () => {
    const state = importFlowReducer(parsedState(), { type: "COVER_SELECTED", url: "https://images.example/b.jpg" });
    expect(state).toMatchObject({ coverUrl: "https://images.example/b.jpg" });
    expect(state.selectedUrls).toEqual(["https://images.example/a.jpg", "https://images.example/b.jpg"]);
  });

  it("supports the no-image confirmation path", () => {
    expect(importFlowReducer(parsedState(), { type: "CONFIRM_OPENED", withoutImages: true })).toMatchObject({
      stage: "recipeConfirm", selectedUrls: [], coverUrl: null, dirty: true
    });
  });

  it("marks edited drafts dirty and retains them after save failure", () => {
    const changed = importFlowReducer(parsedState(), { type: "DRAFT_CHANGED", draft: { ...draft, name: "新菜名" } });
    const failed = importFlowReducer(importFlowReducer(changed, { type: "SAVE_STARTED" }), { type: "SAVE_FAILED", message: "保存失败" });
    expect(failed).toMatchObject({ stage: "recipeConfirm", dirty: true, error: "保存失败", draft: { name: "新菜名" } });
  });

  it("resets all draft state after save success", () => {
    expect(importFlowReducer(parsedState(), { type: "RESET" })).toEqual(initialImportFlowState);
  });

  it("returns from image review without discarding parsed recipe state", () => {
    expect(importFlowReducer(parsedState(), { type: "REVIEW_BACK" })).toMatchObject({ stage: "home", draft, reviewUrls: ["https://images.example/a.jpg", "https://images.example/b.jpg"] });
  });
});

describe("ImportFlow V3 screens", () => {
  beforeEach(() => {
    mocks.push.mockReset(); mocks.parseImportApi.mockReset(); mocks.filterImages.mockReset(); mocks.saveRecipeWithImages.mockReset(); mocks.listRecipesApi.mockReset(); mocks.listRecipesApi.mockResolvedValue({ recipes: [] });
  });

  it("keeps drawer input, exposes the paste hint, and disables an empty orange parse action", () => {
    const change = vi.fn(); const open = vi.fn();
    const { rerender } = render(<ImportSheet open rawInput="已粘贴文本" error="解析失败" onOpenChange={open} onInputChange={change} onPaste={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("粘贴小红书分享文字即可自动解析")).toBeInTheDocument();
    expect(screen.getByDisplayValue("已粘贴文本")).toBeInTheDocument();
    expect(screen.getByText("解析失败")).toBeInTheDocument();
    rerender(<ImportSheet open rawInput="" error={null} onOpenChange={open} onInputChange={change} onPaste={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "开始解析" })).toBeDisabled();
  });

  it("renders parsing source card, four semantic stages, live status and cancellation dialog", () => {
    render(<ParsingProgress step={1} source="来自小红书 · 丝瓜炒蛋" onCancel={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "正在解析" })).toBeInTheDocument();
    expect(screen.getByText("来自小红书 · 丝瓜炒蛋")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消解析" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("toggles selected thumbnails, changes cover, and retains a fixed no-image action", () => {
    const toggle = vi.fn(); const cover = vi.fn(); const confirm = vi.fn();
    render(<ImageReviewScreen urls={["https://images.example/a.jpg", "https://images.example/b.jpg"]} selectedUrls={["https://images.example/a.jpg"]} coverUrl="https://images.example/a.jpg" onBack={vi.fn()} onToggle={toggle} onCover={cover} onConfirm={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "预览第 2 张图片" }));
    expect(toggle).toHaveBeenCalledWith("https://images.example/b.jpg");
    fireEvent.click(screen.getByRole("button", { name: "设为封面" }));
    expect(cover).toHaveBeenCalledWith("https://images.example/b.jpg");
    expect(screen.getByRole("button", { name: "无图保存" }).closest("footer")).toHaveClass("fixed");
  });

  it("preserves confirmation edits and exposes metadata controls", () => {
    const onChange = vi.fn(); render(<RecipeConfirmForm draft={draft} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("菜名"), { target: { value: "更新菜名" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "更新菜名" }));
    expect(screen.getByLabelText("烹饪时间")).toBeInTheDocument();
    expect(screen.getByLabelText("难度")).toBeInTheDocument();
  });

  it("aborts a stale parse on unmount and ignores its late response", async () => {
    let resolve!: (value: { recipe: RecipeDraft; imageUrls: string[]; needsSupplement: boolean; crawlStatus: string; crawlError: string }) => void;
    mocks.parseImportApi.mockImplementation((_input: unknown, signal?: AbortSignal) => new Promise((done) => { resolve = done; expect(signal).toBeDefined(); }));
    const { unmount } = render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" }));
    fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } });
    fireEvent.click(screen.getByRole("button", { name: "开始解析" }));
    const signal = mocks.parseImportApi.mock.calls[0]?.[1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    resolve({ recipe: draft, imageUrls: [], needsSupplement: false, crawlStatus: "ok", crawlError: "" });
    await waitFor(() => expect(mocks.filterImages).not.toHaveBeenCalled());
  });
});
