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

    expect(screen.getByText("老公菜谱")).toBeInTheDocument();
    expect(screen.getByText("今晚做什么")).toBeInTheDocument();
    expect(screen.getByText("今晚认真做一道菜")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "从小红书导入菜谱" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/小红书/i)).not.toBeInTheDocument();
    expect(await screen.findByText("番茄炒蛋")).toBeInTheDocument();
    expect(screen.getByText("红烧肉")).toBeInTheDocument();
    expect(screen.getByText("清炒西兰花")).toBeInTheDocument();
    expect(screen.queryByText("不该出现")).not.toBeInTheDocument();
  });

  it("preserves raw input across open close, disables empty submit, and keeps focus on paste rejection", async () => {
    const readText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { readText } });

    render(<ImportFlow />);

    await openImportSheet();

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
    expect(screen.getByText("已选 2 张")).toBeInTheDocument();
    expect(screen.queryByText(/筛图失败|图片筛选失败/)).not.toBeInTheDocument();
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
    expect(screen.getByText("已选 0 张")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "无图保存" }));

    expect(await screen.findByText("保存菜谱")).toBeInTheDocument();
    const nameInput = screen.getByLabelText("菜名");
    fireEvent.change(nameInput, { target: { value: "改过的菜名" } });
    fireEvent.click(screen.getByRole("button", { name: "返回图片审核" }));
    expect(await screen.findByText("图片审核")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认图片并继续" }));

    expect(await screen.findByDisplayValue("改过的菜名")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "确认图片并继续" }));

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

  it("reorders ingredients and seasonings in both saved draft and save payload", async () => {
    mockState.parseImportApi.mockResolvedValue({
      recipe: makeDraft({
        ingredients: [
          { name: "丝瓜", amount: "1根", type: "ingredient" },
          { name: "鸡蛋", amount: "2个", type: "ingredient" }
        ],
        seasonings: [
          { name: "盐", amount: "1勺", type: "seasoning" },
          { name: "蒜", amount: "2瓣", type: "seasoning" }
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
    fireEvent.click(await screen.findByRole("button", { name: "确认图片并继续" }));

    fireEvent.click(screen.getByRole("button", { name: "下移食材 1" }));
    fireEvent.click(screen.getByRole("button", { name: "下移调料 1" }));

    expect(screen.getAllByLabelText("食材名称").map((node) => (node as HTMLInputElement).value)).toEqual(["鸡蛋", "丝瓜"]);
    expect(screen.getAllByLabelText("调料名称").map((node) => (node as HTMLInputElement).value)).toEqual(["蒜", "盐"]);

    fireEvent.click(screen.getByRole("button", { name: "保存草稿" }));

    const savedDraft = JSON.parse(window.sessionStorage.getItem("import-flow-draft") ?? "{}");
    expect(savedDraft.draft.ingredients.map((item: { name: string }) => item.name)).toEqual(["鸡蛋", "丝瓜"]);
    expect(savedDraft.draft.seasonings.map((item: { name: string }) => item.name)).toEqual(["蒜", "盐"]);

    fireEvent.click(screen.getByRole("button", { name: "保存菜谱" }));

    await waitFor(() => {
      expect(mockState.saveRecipeWithImages).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredients: [
            expect.objectContaining({ name: "鸡蛋" }),
            expect.objectContaining({ name: "丝瓜" })
          ],
          seasonings: [
            expect.objectContaining({ name: "蒜" }),
            expect.objectContaining({ name: "盐" })
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
    fireEvent.click(await screen.findByRole("button", { name: "确认图片并继续" }));

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
});
