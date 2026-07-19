import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  const MotionDiv = forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => React.createElement("div", { ...props, ref }, children));
  MotionDiv.displayName = "MotionDiv";
  return { useReducedMotion: () => false, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, motion: { div: MotionDiv } };
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

  it("round-trips confirmation to image review without resetting a non-first cover", () => {
    const review = importFlowReducer(parsedState(), { type: "COVER_SELECTED", url: "https://images.example/b.jpg" });
    const confirmed = importFlowReducer(review, { type: "CONFIRM_OPENED" });
    expect(importFlowReducer(confirmed, { type: "CONFIRM_BACK" })).toMatchObject({ stage: "imageReview", draft, selectedUrls: review.selectedUrls, coverUrl: "https://images.example/b.jpg" });
  });
});

describe("ImportFlow V3 screens", () => {
  beforeEach(() => {
    mocks.push.mockReset(); mocks.parseImportApi.mockReset(); mocks.filterImages.mockReset(); mocks.saveRecipeWithImages.mockReset(); mocks.listRecipesApi.mockReset(); mocks.listRecipesApi.mockResolvedValue({ recipes: [] });
    window.sessionStorage.clear();
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

  it("marks parsing and confirmation actions for press feedback that can be disabled for reduced motion", () => {
    render(<ParsingProgress step={0} source="来源" onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "取消解析" })).toHaveAttribute("data-press-feedback", "apple");
    fireEvent.click(screen.getByRole("button", { name: "取消解析" }));
    expect(screen.getByRole("button", { name: "继续解析" })).toHaveAttribute("data-press-feedback", "apple");
  });

  it("toggles selected thumbnails, changes cover, and retains a fixed no-image action", () => {
    const toggle = vi.fn(); const cover = vi.fn(); const confirm = vi.fn();
    render(<ImageReviewScreen urls={["https://images.example/a.jpg", "https://images.example/b.jpg"]} selectedUrls={["https://images.example/a.jpg"]} coverUrl="https://images.example/a.jpg" onBack={vi.fn()} onToggle={toggle} onCover={cover} onConfirm={confirm} />);
    expect(screen.getByRole("button", { name: "取消选择第 1 张图片" })).toHaveAttribute("aria-pressed", "true");
    const secondThumbnail = screen.getByRole("button", { name: "选择第 2 张图片" });
    expect(secondThumbnail).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(secondThumbnail);
    expect(toggle).toHaveBeenCalledWith("https://images.example/b.jpg");
    fireEvent.click(screen.getByRole("button", { name: "设为封面" }));
    expect(cover).toHaveBeenCalledWith("https://images.example/b.jpg");
    expect(screen.getByRole("button", { name: "无图保存" }).closest("footer")).toHaveClass("fixed");
  });

  it("uses a transaction screen contract without review arrows or a cancel-selection action", () => {
    render(<ImageReviewScreen urls={["https://images.example/a.jpg"]} selectedUrls={["https://images.example/a.jpg"]} coverUrl="https://images.example/a.jpg" onBack={vi.fn()} onToggle={vi.fn()} onCover={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByTestId("image-review-page")).toHaveAttribute("data-transaction-screen", "true");
    expect(screen.queryByRole("button", { name: "上一张图片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一张图片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消选择" })).not.toBeInTheDocument();
    expect(screen.getByText("封面图")).toBeInTheDocument();
  });

  it("preserves confirmation edits and exposes metadata controls", () => {
    const onChange = vi.fn(); render(<RecipeConfirmForm draft={draft} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("菜名"), { target: { value: "更新菜名" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "更新菜名" }));
    expect(screen.getByLabelText("烹饪时间")).toBeInTheDocument();
    expect(screen.getByLabelText("难度")).toBeInTheDocument();
  });

  it("renders closed tag chips with an add action and inline metadata", () => {
    render(<RecipeConfirmForm draft={{ ...draft, tags: ["家常菜"] }} onChange={vi.fn()} />);
    expect(screen.getByText("家常菜")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加标签" })).toBeInTheDocument();
    expect(screen.getByTestId("recipe-confirm-form")).toHaveClass("recipe-confirm-form");
    expect(screen.queryByLabelText("标签")).not.toBeInTheDocument();
  });

  it("renames a tag without duplicates and deletes an existing tag", () => {
    const onChange = vi.fn();
    const initialDraft = { ...draft, tags: ["家常菜", "快手菜"] };
    const { rerender } = render(<RecipeConfirmForm draft={initialDraft} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑标签 家常菜" }));
    fireEvent.change(screen.getByLabelText("标签名称"), { target: { value: "快手菜" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["快手菜"] }));
    rerender(<RecipeConfirmForm draft={{ ...initialDraft, tags: ["快手菜"] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑标签 快手菜" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "删除标签 快手菜" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: [] }));
  });

  it("adds ingredients and steps through compact section-heading controls", async () => {
    const onChange = vi.fn();
    render(<RecipeConfirmForm draft={draft} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "添加食材或调料" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "添加食材" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ingredients: [expect.objectContaining({ type: "ingredient" })] }));
    fireEvent.click(screen.getByRole("button", { name: "添加步骤" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ steps: expect.arrayContaining([expect.objectContaining({ order: 2 })]) }));
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

  it("shows validation feedback for an empty name and no meaningful step", async () => {
    mocks.parseImportApi.mockResolvedValue({ recipe: { ...draft, name: "", steps: [{ order: 1, text: "" }] }, imageUrls: [], needsSupplement: false, crawlStatus: "ok", crawlError: "" });
    mocks.filterImages.mockResolvedValue([]);
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" }));
    fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } });
    fireEvent.click(screen.getByRole("button", { name: "开始解析" }));
    fireEvent.click(await screen.findByRole("button", { name: "无图保存" }));
    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));
    expect(await screen.findByText("请填写菜名")).toBeInTheDocument();
    expect(screen.getByText("请至少填写一个步骤")).toBeInTheDocument();
  });

  it("keeps rendered edits visible when saving fails", async () => {
    mocks.parseImportApi.mockResolvedValue({ recipe: draft, imageUrls: [], needsSupplement: false, crawlStatus: "ok", crawlError: "" });
    mocks.filterImages.mockResolvedValue([]); mocks.saveRecipeWithImages.mockRejectedValue(new Error("保存失败"));
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" })); fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } }); fireEvent.click(screen.getByRole("button", { name: "开始解析" })); fireEvent.click(await screen.findByRole("button", { name: "无图保存" }));
    fireEvent.change(screen.getByLabelText("菜名"), { target: { value: "保留的编辑" } }); fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));
    expect(await screen.findByText("保存失败")).toBeInTheDocument(); expect(screen.getByDisplayValue("保留的编辑")).toBeInTheDocument();
  });

  it("clears session draft and navigates after a successful save", async () => {
    mocks.saveRecipeWithImages.mockResolvedValue({ id: 42 }); window.sessionStorage.setItem("import-flow-draft", JSON.stringify({ ...initialImportFlowState, stage: "recipeConfirm", draft, dirty: true }));
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "保存菜谱" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recipes/42")); expect(window.sessionStorage.getItem("import-flow-draft")).toBeNull();
  });

  it("automatically persists a dirty confirmation draft", async () => {
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" }));
    mocks.parseImportApi.mockResolvedValue({ recipe: draft, imageUrls: [], needsSupplement: false, crawlStatus: "ok", crawlError: "" }); mocks.filterImages.mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } }); fireEvent.click(screen.getByRole("button", { name: "开始解析" })); fireEvent.click(await screen.findByRole("button", { name: "无图保存" }));
    await waitFor(() => expect(window.sessionStorage.getItem("import-flow-draft")).toContain("recipeConfirm"));
  });

  it("resumes image review from the drawer without parsing again", async () => {
    mocks.parseImportApi.mockResolvedValue({ recipe: draft, imageUrls: ["https://images.example/a.jpg"], needsSupplement: false, crawlStatus: "ok", crawlError: "" });
    mocks.filterImages.mockResolvedValue(["https://images.example/a.jpg"]);
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" }));
    fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } });
    fireEvent.click(screen.getByRole("button", { name: "开始解析" }));
    fireEvent.click(await screen.findByRole("button", { name: "返回解析结果" }));
    expect(await screen.findByText("解析完成")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续审核图片" }));
    expect(await screen.findByRole("heading", { name: "审核图片" })).toBeInTheDocument();
    expect(mocks.parseImportApi).toHaveBeenCalledTimes(1);
    expect(mocks.filterImages).toHaveBeenCalledTimes(1);
  });

  it("falls back to every source image when image filtering rejects", async () => {
    mocks.parseImportApi.mockResolvedValue({ recipe: draft, imageUrls: ["https://images.example/a.jpg", "https://images.example/b.jpg"], needsSupplement: false, crawlStatus: "ok", crawlError: "" }); mocks.filterImages.mockRejectedValue(new Error("筛图失败"));
    render(<ImportFlow />);
    fireEvent.click(await screen.findByRole("button", { name: "导入新菜谱" })); fireEvent.change(screen.getByLabelText("分享文本"), { target: { value: "分享文本" } }); fireEvent.click(screen.getByRole("button", { name: "开始解析" }));
    expect(await screen.findByText("已选择 2 张")).toBeInTheDocument();
  });
});
