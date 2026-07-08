import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportFlow } from "@/components/import-flow";
import { RecipeDraft } from "@/lib/domain/recipe";

const mockState = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    parseImportApi: vi.fn(),
    filterImages: vi.fn(),
    saveRecipeWithImages: vi.fn(),
    listRecipesApi: vi.fn()
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockState.push })
}));

vi.mock("@/lib/http/api-client", () => ({
  parseImportApi: mockState.parseImportApi,
  filterImages: mockState.filterImages,
  saveRecipeWithImages: mockState.saveRecipeWithImages,
  listRecipesApi: mockState.listRecipesApi
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMotion = (tag: "div" | "section" | "img") =>
    forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children)
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: createMotion("div"),
      section: createMotion("section"),
      img: createMotion("img")
    },
    useReducedMotion: () => false
  };
});

function makeDraft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    name: "丝瓜炒蛋",
    mainCategory: "家常菜",
    tags: ["下饭", "快手"],
    ingredients: [
      { name: "丝瓜", amount: "1根", type: "ingredient" },
      { name: "鸡蛋", amount: "2个", type: "ingredient" }
    ],
    seasonings: [{ name: "盐", amount: "1勺", type: "seasoning" }],
    steps: [
      { order: 1, text: "切好丝瓜" },
      { order: 2, text: "炒蛋再合炒" }
    ],
    cookTimeMinutes: 15,
    difficulty: "easy",
    tips: "先炒蛋",
    confidence: 0.9,
    missingFields: [],
    sourcePlatform: "xiaohongshu",
    sourceUrl: "https://xhslink.com/demo",
    originalTitle: "超下饭丝瓜炒蛋",
    shareText: "分享文案",
    coverImageUrl: null,
    imageUrls: [],
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function openImportSheet() {
  fireEvent.click(screen.getByRole("button", { name: "从小红书导入菜谱" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
}

async function startImport(rawInput = "分享文本 http://xhslink.com/demo") {
  await openImportSheet();
  const textarea = screen.getByLabelText("分享文本");
  fireEvent.change(textarea, { target: { value: rawInput } });
  fireEvent.click(screen.getByRole("button", { name: "开始智能解析" }));
}

beforeEach(() => {
  mockState.push.mockReset();
  mockState.parseImportApi.mockReset();
  mockState.filterImages.mockReset();
  mockState.saveRecipeWithImages.mockReset();
  mockState.listRecipesApi.mockReset();
  mockState.listRecipesApi.mockResolvedValue({ recipes: [] });
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("ImportFlow v2 state flow", () => {
  it("renders the v2 home with an import row instead of a textarea", async () => {
    mockState.listRecipesApi.mockResolvedValue({
      recipes: [
        { id: 1, name: "番茄炒蛋", cookedCount: 2, difficulty: "easy", mainCategory: "家常菜", wifeRating: 4, coverImageUrl: "cover-1" },
        { id: 2, name: "红烧肉", cookedCount: 1, difficulty: "hard", mainCategory: "荤菜", wifeRating: 5, coverImageUrl: "cover-2" },
        { id: 3, name: "清炒西兰花", cookedCount: 1, difficulty: "easy", mainCategory: "素菜", wifeRating: 4, coverImageUrl: "cover-3" },
        { id: 4, name: "不该出现", cookedCount: 3, difficulty: "medium", mainCategory: "家常菜", wifeRating: 4, coverImageUrl: "cover-4" }
      ]
    });

    render(<ImportFlow />);

    expect(screen.getByTestId("home-page")).toHaveClass("home-page");
    expect(screen.getByText("老公菜谱")).toBeInTheDocument();
    expect(screen.getByText("今晚做什么")).toBeInTheDocument();
    expect(screen.getByText("今晚认真做一道菜")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "今晚认真做一道菜" })).toHaveClass("home-hero-image");
    expect(screen.getByRole("button", { name: "从小红书导入菜谱" })).toHaveClass("home-import-row");
    expect(screen.getByText("粘贴分享文字，自动整理食材与步骤")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看全部" })).toHaveAttribute("href", "/recipes");
    expect(screen.queryByPlaceholderText(/小红书/i)).not.toBeInTheDocument();
    expect(await screen.findByText("番茄炒蛋")).toBeInTheDocument();
    expect(screen.getByText("红烧肉")).toBeInTheDocument();
    expect(screen.queryByText("清炒西兰花")).not.toBeInTheDocument();
    expect(screen.queryByText("不该出现")).not.toBeInTheDocument();
  });

  it("formats the home recent list like the reference screenshot", async () => {
    mockState.listRecipesApi.mockResolvedValue({
      recipes: [
        { id: 1, name: "番茄炖牛腩", cookedCount: 1, cookTimeMinutes: 45, wifeRating: 4.8, coverImageUrl: "beef.jpg" },
        { id: 2, name: "蒜香鸡翅", cookedCount: 3, cookTimeMinutes: 30, coverImageUrl: "wings.jpg" }
      ]
    });

    render(<ImportFlow />);

    expect(await screen.findByText("番茄炖牛腩")).toBeInTheDocument();
    expect(screen.getByText("45 分钟 · 老婆评分 4.8")).toBeInTheDocument();
    expect(screen.getByText("蒜香鸡翅")).toBeInTheDocument();
    expect(screen.getByText("30 分钟 · 做过 3 次")).toBeInTheDocument();
  });

  it("preserves raw input across open close, disables empty submit, and keeps focus on paste rejection", async () => {
    const readText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { readText } });

    render(<ImportFlow />);

    await openImportSheet();
    expect(screen.getByRole("dialog")).toHaveClass("bottom-sheet");
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByLabelText("分享文本")).toHaveClass("import-sheet-textarea");
    expect(screen.getByRole("button", { name: "开始智能解析" })).toHaveClass("import-sheet-submit");

    const submit = screen.getByRole("button", { name: "开始智能解析" });
    expect(submit).toBeDisabled();

    const textarea = screen.getByLabelText("分享文本");
    fireEvent.change(textarea, { target: { value: "已填写内容" } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openImportSheet();
    expect(screen.getByDisplayValue("已填写内容")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "粘贴分享文本" }));

    expect(await screen.findByText("无法读取剪贴板，请手动粘贴")).toBeInTheDocument();
    expect(screen.getByLabelText("分享文本")).toHaveFocus();
  });

  it("shows the four parsing labels and returns to the sheet on parse rejection", async () => {
    mockState.parseImportApi.mockRejectedValue(new Error("解析失败"));

    render(<ImportFlow />);

    await startImport();

    expect(await screen.findByText("正在整理菜谱")).toBeInTheDocument();
    expect(screen.getByText("识别分享内容")).toBeInTheDocument();
    expect(screen.getByText("读取菜谱正文")).toBeInTheDocument();
    expect(screen.getByText("整理食材和步骤")).toBeInTheDocument();
    expect(screen.getByText("筛选菜谱图片")).toBeInTheDocument();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("解析失败")).toBeInTheDocument();
    expect(screen.getByDisplayValue("分享文本 http://xhslink.com/demo")).toBeInTheDocument();
  });

  it("matches the 1:1 parsing progress design contract", async () => {
    const parseRequest = deferred<{
      recipe: RecipeDraft;
      imageUrls: string[];
      needsSupplement: boolean;
      crawlStatus: string;
      crawlError: string;
    }>();
    mockState.parseImportApi.mockReturnValue(parseRequest.promise);

    render(<ImportFlow />);

    await startImport("来自小红书 · 番茄炖牛腩 http://xhslink.com/demo");

    const page = await screen.findByTestId("import-parsing-page");
    expect(page).toHaveClass("import-parsing-page");
    expect(screen.getByRole("img", { name: "正在整理菜谱" })).toHaveClass("import-parsing-hero-image");
    expect(screen.getByText("来自小红书 · 番茄炖牛腩")).toHaveClass("import-parsing-source");
    expect(screen.getByRole("list", { name: "解析进度" })).toHaveClass("import-parsing-timeline");
    expect(screen.getAllByTestId("import-parsing-step")).toHaveLength(4);
    expect(screen.getAllByTestId("import-parsing-step")[0]).toHaveClass("is-current");
    expect(screen.getByText("AI 正在核对用量与顺序")).toBeInTheDocument();
    expect(screen.getByText("您的输入已自动保存")).toHaveClass("import-parsing-hint");
    expect(screen.getByRole("button", { name: "取消解析" })).toHaveClass("import-parsing-cancel");
  });

  it("treats filter fallback as a successful degraded path and enters image review", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft(),
      imageUrls: ["a.jpg", "b.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg", "b.jpg"]);

    render(<ImportFlow />);

    await startImport();

    expect(await screen.findByText("图片审核")).toBeInTheDocument();
    expect(screen.getByText("2 / 2 已选")).toBeInTheDocument();
    expect(screen.queryByText(/筛图失败|图片筛选失败/)).not.toBeInTheDocument();
  });

  it("matches the 1:1 image review design contract with all source images visible", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({ name: "番茄炖牛腩" }),
      imageUrls: ["cover.jpg", "beef.jpg", "tomato.jpg", "spice.jpg", "portrait.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["cover.jpg", "beef.jpg", "tomato.jpg"]);

    render(<ImportFlow />);

    await startImport();

    const page = await screen.findByTestId("image-review-page");
    expect(page).toHaveClass("image-review-page");
    expect(screen.getByText("选择菜谱图片")).toHaveClass("image-review-title");
    expect(screen.getByText("3 / 5 已选")).toHaveClass("image-review-count");
    expect(screen.getByText("保留真正有助于做菜的图片")).toHaveClass("image-review-subtitle");
    expect(screen.getByTestId("image-review-carousel")).toHaveClass("image-review-carousel");
    expect(screen.getByRole("img", { name: "图片 1" })).toHaveClass("image-review-main-image");
    expect(screen.getByTestId("image-review-thumbnails")).toHaveClass("image-review-thumbnails");
    expect(screen.getAllByTestId("image-review-thumbnail")).toHaveLength(5);
    expect(screen.getAllByTestId("image-review-thumbnail")[0]).toHaveClass("is-selected");
    expect(screen.getAllByTestId("image-review-thumbnail")[3]).toHaveClass("is-muted");
    expect(screen.getByRole("button", { name: "设为封面" })).toHaveClass("image-review-action");
    expect(screen.getByRole("button", { name: "取消选择" })).toHaveClass("image-review-action");
    expect(screen.getByText("AI 已推荐 3 张，你可以继续调整")).toHaveClass("image-review-note");
    expect(screen.getByRole("button", { name: "确认图片（3）" })).toHaveClass("image-review-submit");
    expect(screen.getByRole("button", { name: "无图保存" })).toHaveClass("image-review-empty");
  });

  it("keeps image review and confirmation actions above the bottom navigation", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft(),
      imageUrls: ["a.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg"]);

    render(<ImportFlow />);

    await startImport();
    const imageReviewActions = (await screen.findByRole("button", { name: /^确认图片/ })).closest(".fixed");
    expect(imageReviewActions).toHaveClass("z-40");

    fireEvent.click(screen.getByRole("button", { name: /^确认图片/ }));
    const confirmationActions = screen.getByRole("button", { name: "保存菜谱" }).closest(".fixed");
    expect(confirmationActions).toHaveClass("z-40");
  });

  it("wraps ingredient and seasoning actions below long editable amounts", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({
        ingredients: [{ name: "丝瓜", amount: "一根去皮后切成非常非常长的滚刀块备用", type: "ingredient" }],
        seasonings: [{ name: "盐", amount: "根据个人口味分多次加入并充分翻炒均匀", type: "seasoning" }]
      }),
      imageUrls: ["a.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg"]);

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: /^确认图片/ }));

    for (const deleteButton of [
      screen.getByRole("button", { name: "删除食材 1" }),
      screen.getByRole("button", { name: "删除调料 1" })
    ]) {
      const row = deleteButton.closest(".grid");
      expect(row).toHaveClass("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
      expect(deleteButton.parentElement).toHaveClass("col-span-2", "justify-end");
    }

    for (const amount of [screen.getByLabelText("食材用量"), screen.getByLabelText("调料用量")]) {
      expect(amount.tagName).toBe("TEXTAREA");
      expect(amount).toHaveClass("resize-none");
      fireEvent.change(amount, { target: { value: "更新后的多行用量" } });
      expect(amount).toHaveValue("更新后的多行用量");
    }
  });

  it("confirms cancel during parsing, reopens the sheet, and ignores the late parse result", async () => {
    const parseRequest = deferred<{
      recipe: RecipeDraft;
      imageUrls: string[];
      needsSupplement: boolean;
      crawlStatus: string;
      crawlError: string;
    }>();
    mockState.parseImportApi.mockReturnValue(parseRequest.promise);
    mockState.filterImages.mockResolvedValue(["late.jpg"]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ImportFlow />);

    await startImport("会被取消的分享");
    fireEvent.click(await screen.findByRole("button", { name: "取消解析" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("会被取消的分享")).toBeInTheDocument();

    parseRequest.resolve({
      recipe: makeDraft(),
      imageUrls: ["late.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });

    await waitFor(() => expect(screen.queryByText("图片审核")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockState.filterImages).not.toHaveBeenCalled();
  });

  it("requires explicit cover selection, supports zero-image continuation, and preserves confirmation edits on back", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft(),
      imageUrls: ["a.jpg", "b.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg", "b.jpg"]);

    render(<ImportFlow />);

    await startImport();

    expect(await screen.findByText("图片审核")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览第 2 张图片" }));
    fireEvent.click(screen.getByRole("button", { name: "设为封面" }));
    fireEvent.click(screen.getByRole("button", { name: "取消选择" }));
    fireEvent.click(screen.getByRole("button", { name: "取消选择" }));
    expect(screen.getByText("0 / 2 已选")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "无图保存" }));

    expect(await screen.findByText("保存菜谱")).toBeInTheDocument();
    const nameInput = screen.getByLabelText("菜名");
    fireEvent.change(nameInput, { target: { value: "改过的菜名" } });
    fireEvent.click(screen.getByRole("button", { name: "返回图片审核" }));
    expect(await screen.findByText("图片审核")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^确认图片/ }));

    expect(await screen.findByDisplayValue("改过的菜名")).toBeInTheDocument();
  });

  it("returns from image review to the parsed result without re-fetching and can continue back into review", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({ name: "回锅肉" }),
      imageUrls: ["a.jpg", "b.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg", "b.jpg"]);

    render(<ImportFlow />);

    await startImport();
    expect(await screen.findByText("图片审核")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回解析结果" }));

    expect(await screen.findByText("解析完成")).toBeInTheDocument();
    expect(screen.getByText("回锅肉")).toBeInTheDocument();
    expect(screen.queryByText("保存菜谱")).not.toBeInTheDocument();
    expect(mockState.parseImportApi).toHaveBeenCalledTimes(1);
    expect(mockState.filterImages).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "继续审核图片" }));

    expect(await screen.findByText("图片审核")).toBeInTheDocument();
    expect(screen.queryByText("解析完成")).not.toBeInTheDocument();
    expect(screen.queryByText("保存菜谱")).not.toBeInTheDocument();
    expect(mockState.parseImportApi).toHaveBeenCalledTimes(1);
    expect(mockState.filterImages).toHaveBeenCalledTimes(1);
  });

  it("keeps the nearest remaining preview selected when deselecting the current middle image", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft(),
      imageUrls: ["a.jpg", "b.jpg", "c.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg", "b.jpg", "c.jpg"]);

    render(<ImportFlow />);

    await startImport();
    expect(await screen.findByText("图片审核")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预览第 2 张图片" }));
    expect(screen.getByAltText("图片 2")).toHaveAttribute("src", "b.jpg");

    fireEvent.click(screen.getByRole("button", { name: "取消选择" }));

    expect(screen.getByAltText("图片 3")).toHaveAttribute("src", "c.jpg");
  });

  it("validates confirmation, renumbers reordered steps, persists draft, and preserves edits after save rejection", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft(),
      imageUrls: ["a.jpg", "b.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg", "b.jpg"]);
    mockState.saveRecipeWithImages.mockRejectedValue(new Error("保存失败"));

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: /^确认图片/ }));

    const nameInput = screen.getByLabelText("菜名");
    fireEvent.change(nameInput, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));
    expect(screen.getByText("请填写菜名")).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: "丝瓜炒蛋 Plus" } });
    const stepItems = screen.getAllByTestId("step-row");
    fireEvent.click(within(stepItems[1]).getByRole("button", { name: "上移步骤 2" }));
    expect(screen.getAllByTestId("step-order").map((node) => node.textContent)).toEqual(["01", "02"]);
    expect((screen.getAllByLabelText("步骤内容")[0] as HTMLTextAreaElement).value).toBe("炒蛋再合炒");

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));
    expect(JSON.parse(window.sessionStorage.getItem("import-flow-draft") ?? "{}").draft.name).toBe("丝瓜炒蛋 Plus");

    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));
    expect(await screen.findByText("保存失败")).toBeInTheDocument();
    expect(screen.getByDisplayValue("丝瓜炒蛋 Plus")).toBeInTheDocument();
  });

  it("persists ingredient and seasoning edits, deletes, and reorder in both draft and save payload", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({
        ingredients: [
          { name: "丝瓜", amount: "1根", type: "ingredient" },
          { name: "鸡蛋", amount: "2个", type: "ingredient" },
          { name: "木耳", amount: "5朵", type: "ingredient" }
        ],
        seasonings: [
          { name: "盐", amount: "1勺", type: "seasoning" },
          { name: "蒜", amount: "2瓣", type: "seasoning" },
          { name: "糖", amount: "半勺", type: "seasoning" }
        ]
      }),
      imageUrls: ["a.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg"]);
    mockState.saveRecipeWithImages.mockResolvedValue({ id: 9 });

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: /^确认图片/ }));

    fireEvent.change(screen.getAllByLabelText("食材名称")[0], { target: { value: "嫩丝瓜" } });
    fireEvent.change(screen.getAllByLabelText("食材用量")[0], { target: { value: "2根" } });
    fireEvent.click(screen.getByRole("button", { name: "删除食材 2" }));
    fireEvent.click(screen.getByRole("button", { name: "下移食材 1" }));
    fireEvent.change(screen.getAllByLabelText("调料名称")[0], { target: { value: "海盐" } });
    fireEvent.change(screen.getAllByLabelText("调料用量")[0], { target: { value: "2勺" } });
    fireEvent.click(screen.getByRole("button", { name: "删除调料 2" }));
    fireEvent.click(screen.getByRole("button", { name: "下移调料 1" }));

    expect(screen.getAllByLabelText("食材名称").map((node) => (node as HTMLInputElement).value)).toEqual(["木耳", "嫩丝瓜"]);
    expect(screen.getAllByLabelText("食材用量").map((node) => (node as HTMLInputElement).value)).toEqual(["5朵", "2根"]);
    expect(screen.getAllByLabelText("调料名称").map((node) => (node as HTMLInputElement).value)).toEqual(["糖", "海盐"]);
    expect(screen.getAllByLabelText("调料用量").map((node) => (node as HTMLInputElement).value)).toEqual(["半勺", "2勺"]);

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));

    const savedDraft = JSON.parse(window.sessionStorage.getItem("import-flow-draft") ?? "{}");
    expect(savedDraft.draft.ingredients).toEqual([
      expect.objectContaining({ name: "木耳", amount: "5朵" }),
      expect.objectContaining({ name: "嫩丝瓜", amount: "2根" })
    ]);
    expect(savedDraft.draft.seasonings).toEqual([
      expect.objectContaining({ name: "糖", amount: "半勺" }),
      expect.objectContaining({ name: "海盐", amount: "2勺" })
    ]);

    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));

    await waitFor(() => {
      expect(mockState.saveRecipeWithImages).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredients: [
            expect.objectContaining({ name: "木耳", amount: "5朵" }),
            expect.objectContaining({ name: "嫩丝瓜", amount: "2根" })
          ],
          seasonings: [
            expect.objectContaining({ name: "糖", amount: "半勺" }),
            expect.objectContaining({ name: "海盐", amount: "2勺" })
          ]
        }),
        ["a.jpg"]
      );
    });
  });

  it("can add a seasoning and include it in the save payload", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({ seasonings: [] }),
      imageUrls: ["a.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["a.jpg"]);
    mockState.saveRecipeWithImages.mockResolvedValue({ id: 10 });

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: /^确认图片/ }));

    fireEvent.click(screen.getByRole("button", { name: "添加调料" }));
    const seasoningNames = screen.getAllByLabelText("调料名称");
    const seasoningAmounts = screen.getAllByLabelText("调料用量");
    fireEvent.change(seasoningNames[0], { target: { value: "葱花" } });
    fireEvent.change(seasoningAmounts[0], { target: { value: "1把" } });

    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));

    await waitFor(() => {
      expect(mockState.saveRecipeWithImages).toHaveBeenCalledWith(
        expect.objectContaining({
          seasonings: [expect.objectContaining({ name: "葱花", amount: "1把", type: "seasoning" })]
        }),
        ["a.jpg"]
      );
    });
  });

  it("restores session draft and routes successful saves to the recipe detail page", async () => {
    window.sessionStorage.setItem("import-flow-draft", JSON.stringify({
      draft: makeDraft({ name: "草稿菜名" }),
      selectedUrls: ["cover.jpg"],
      coverUrl: "cover.jpg"
    }));
    mockState.listRecipesApi.mockResolvedValue({ recipes: [] });
    mockState.saveRecipeWithImages.mockResolvedValue({ id: 42 });

    render(<ImportFlow />);

    expect(await screen.findByDisplayValue("草稿菜名")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));

    await waitFor(() => {
      expect(mockState.saveRecipeWithImages).toHaveBeenCalledWith(
        expect.objectContaining({ coverImageUrl: "cover.jpg", name: "草稿菜名" }),
        ["cover.jpg"]
      );
    });
    expect(mockState.push).toHaveBeenCalledWith("/recipes/42");
    expect(window.sessionStorage.getItem("import-flow-draft")).toBeNull();
  });

  it("matches the 1:1 recipe confirmation design contract", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({
        name: "番茄炖牛腩",
        mainCategory: "家常菜",
        difficulty: "medium",
        cookTimeMinutes: 45,
        tags: ["下饭菜", "炖菜", "牛肉"],
        ingredients: [
          { name: "牛腩", amount: "500 克", type: "ingredient" },
          { name: "番茄", amount: "3 个", type: "ingredient" },
          { name: "洋葱", amount: "半个", type: "ingredient" },
          { name: "生抽", amount: "2 勺", type: "seasoning" }
        ],
        seasonings: [],
        steps: [
          { order: 1, text: "牛腩冷水下锅，加入姜片、料酒，焯水煮出浮沫，捞出冲洗干净备用。" },
          { order: 2, text: "热锅冷油，放入洋葱炒香，再加入番茄块，炒出汤汁。" },
          { order: 3, text: "加入牛腩小火炖煮。" }
        ]
      }),
      imageUrls: ["cover.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["cover.jpg"]);

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: "确认图片（1）" }));

    const page = await screen.findByTestId("recipe-confirm-page");
    expect(page).toHaveClass("recipe-confirm-page");
    expect(screen.getByText("确认菜谱")).toHaveClass("recipe-confirm-title");
    expect(screen.getByRole("button", { name: "保存草稿" })).toHaveClass("recipe-confirm-draft-button");
    expect(screen.getByTestId("recipe-confirm-form")).toHaveClass("recipe-confirm-form");
    expect(screen.getByTestId("recipe-confirm-summary")).toHaveClass("recipe-confirm-summary");
    expect(screen.getByTestId("recipe-confirm-cover")).toHaveClass("recipe-confirm-cover");
    expect(screen.getByLabelText("菜名")).toHaveClass("recipe-confirm-name");
    expect(screen.getByText("家常菜 · 中等 · 45 分钟")).toHaveClass("recipe-confirm-meta");
    expect(screen.getByRole("tablist", { name: "菜谱确认分区" })).toHaveClass("recipe-confirm-tabs");
    expect(screen.getByText("标签")).toHaveClass("recipe-confirm-section-title");
    expect(screen.getByText("下饭菜")).toHaveClass("recipe-confirm-tag");
    expect(screen.getByTestId("recipe-confirm-ingredients")).toHaveClass("recipe-confirm-ingredients");
    expect(screen.getAllByLabelText("食材名称")[0]).toHaveClass("recipe-confirm-ingredient-name");
    expect(screen.getAllByLabelText("食材用量")[0]).toHaveClass("recipe-confirm-ingredient-amount");
    expect(screen.getByText("制作步骤")).toHaveClass("recipe-confirm-section-title");
    expect(screen.getAllByTestId("step-row")[0]).toHaveClass("recipe-confirm-step");
    expect(screen.getAllByTestId("step-order")[0]).toHaveClass("recipe-confirm-step-order");
    expect(screen.getByText("查看全部 3 步")).toHaveClass("recipe-confirm-more");
    expect(screen.getByText("请确认食材用量后再保存")).toHaveClass("recipe-confirm-save-hint");
    expect(screen.getByRole("button", { name: "保存菜谱" })).toHaveClass("recipe-confirm-submit");

    expect(screen.getByRole("button", { name: "删除食材 1" }).parentElement).toHaveClass("recipe-confirm-layout-hidden");
    expect(screen.getByRole("button", { name: "上移步骤 1" })).toHaveClass("recipe-confirm-layout-hidden");
    expect(screen.getByRole("button", { name: "添加食材" })).toHaveClass("recipe-confirm-layout-hidden");
    expect(screen.getByRole("button", { name: "添加步骤" })).toHaveClass("recipe-confirm-layout-hidden");
    expect(screen.getAllByTestId("recipe-confirm-step-grip")[0]).toHaveClass("recipe-confirm-step-grip");
  });

  it("keeps confirmation preview controls interactive after the 1:1 restyle", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("清爽");
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({
        tags: ["快手菜", "下饭菜", "炒菜"],
        ingredients: [
          { name: "丝瓜", amount: "1根", type: "ingredient" },
          { name: "鸡蛋", amount: "2个", type: "ingredient" }
        ],
        seasonings: [{ name: "盐", amount: "适量", type: "seasoning" }],
        steps: [
          { order: 1, text: "丝瓜去皮，切成滚刀块或片状。" },
          { order: 2, text: "鸡蛋打散，加少许盐拌匀。" },
          { order: 3, text: "热锅下油，倒入鸡蛋炒散。" }
        ]
      }),
      imageUrls: ["cover.jpg"],
      needsSupplement: false,
      crawlStatus: "ok",
      crawlError: ""
    });
    mockState.filterImages.mockResolvedValue(["cover.jpg"]);

    render(<ImportFlow />);

    await startImport();
    fireEvent.click(await screen.findByRole("button", { name: "确认图片（1）" }));

    const nameInput = await screen.findByLabelText("菜名");
    fireEvent.click(screen.getByRole("button", { name: "编辑菜名" }));
    expect(nameInput).toHaveFocus();

    const overviewTab = screen.getByRole("tab", { name: "概览" });
    const ingredientsTab = screen.getByRole("tab", { name: "食材" });
    const stepsTab = screen.getByRole("tab", { name: "步骤" });
    fireEvent.click(ingredientsTab);
    expect(ingredientsTab).toHaveAttribute("aria-selected", "true");
    expect(ingredientsTab).toHaveClass("is-active");
    expect(overviewTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(stepsTab);
    expect(stepsTab).toHaveAttribute("aria-selected", "true");
    expect(stepsTab).toHaveClass("is-active");

    fireEvent.click(screen.getByRole("button", { name: "添加标签" }));
    expect(promptSpy).toHaveBeenCalled();
    expect(screen.getByText("清爽")).toHaveClass("recipe-confirm-tag");

    const ingredientList = screen.getByTestId("recipe-confirm-ingredient-list");
    expect(ingredientList).not.toHaveClass("is-expanded");
    fireEvent.click(screen.getByRole("button", { name: "查看全部 3 项" }));
    expect(ingredientList).toHaveClass("is-expanded");
    expect(screen.getByRole("button", { name: "收起食材与调料" })).toHaveClass("recipe-confirm-more");

    const stepList = screen.getByTestId("recipe-confirm-step-list");
    fireEvent.click(screen.getByRole("button", { name: "查看全部 3 步" }));
    expect(stepList).toHaveClass("is-expanded");

    for (const amount of screen.getAllByLabelText(/(?:食材|调料)用量/)) {
      expect(amount).toHaveAttribute("rows", "1");
    }
  });
});
