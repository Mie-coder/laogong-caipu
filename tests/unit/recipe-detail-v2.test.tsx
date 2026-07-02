import { forwardRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeDetail } from "@/components/recipe-detail";

const mockState = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    getRecipeApi: vi.fn(),
    addCookingLogApi: vi.fn(),
    deleteRecipeApi: vi.fn(),
    reducedMotion: false
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockState.push })
}));

vi.mock("@/lib/http/api-client", () => ({
  getRecipeApi: mockState.getRecipeApi,
  addCookingLogApi: mockState.addCookingLogApi,
  deleteRecipeApi: mockState.deleteRecipeApi
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMotion = (tag: "div" | "section" | "button" | "img") =>
    forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children)
    );

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: createMotion("div"),
      section: createMotion("section"),
      button: createMotion("button"),
      img: createMotion("img")
    },
    useReducedMotion: () => mockState.reducedMotion
  };
});

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: "番茄炖牛腩",
    mainCategory: "家常菜",
    coverImageUrl: "https://example.com/cover.jpg",
    cookedCount: 3,
    difficulty: "medium",
    tags: ["下饭"],
    latestWifeFeedback: "",
    wifeRating: 4.8,
    sourcePlatform: "xhs",
    sourceUrl: "",
    originalTitle: "",
    shareText: "",
    cookTimeMinutes: 45,
    tips: "番茄先炒出沙。",
    imageUrls: ["https://example.com/cover.jpg", "https://example.com/step-1.jpg"],
    ingredients: [
      { name: "牛腩", amount: "500 克", type: "ingredient" },
      { name: "番茄", amount: "3 个", type: "ingredient" }
    ],
    seasonings: [{ name: "生抽", amount: "2 勺", type: "seasoning" }],
    steps: [
      { order: 1, text: "牛腩切块，冷水下锅焯去血沫。", imageUrl: "https://example.com/step-1.jpg" },
      { order: 2, text: "番茄炒软后和牛腩一起炖煮。", imageUrl: null }
    ],
    cookingLogs: [
      {
        id: 1,
        cookedAt: "2026-07-02T19:30:00.000Z",
        wifeFeedback: "牛腩很软",
        wifeRating: 4,
        husbandImprovementNotes: "少盐",
        notes: ""
      }
    ],
    ...overrides
  };
}

beforeEach(() => {
  mockState.push.mockReset();
  mockState.getRecipeApi.mockReset();
  mockState.addCookingLogApi.mockReset();
  mockState.deleteRecipeApi.mockReset();
  mockState.reducedMotion = false;
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  mockState.getRecipeApi.mockResolvedValue({ recipe: makeRecipe() });
  mockState.addCookingLogApi.mockResolvedValue({ ok: true });
  mockState.deleteRecipeApi.mockResolvedValue({ ok: true });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn()
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn()
  });
});

describe("RecipeDetail v2", () => {
  it("renders the editorial image-first layout with anchors, aligned prep rows, numbered steps, and both actions visible", async () => {
    render(<RecipeDetail id={7} />);

    expect(await screen.findByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "备料" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "步骤" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看复盘" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记做过" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();

    const beef = screen.getByLabelText("勾选食材 牛腩");
    expect(beef).toBeInTheDocument();
    expect(beef.closest("li")?.textContent).toContain("500 克");
    expect(screen.queryByRole("button", { name: "菜谱信息" })).not.toBeInTheDocument();
  });

  it("keeps ingredient checks local only and never sends them to the API payload", async () => {
    render(<RecipeDetail id={7} />);

    fireEvent.click(await screen.findByLabelText("勾选食材 牛腩"));
    fireEvent.click(screen.getByRole("button", { name: "标记做过" }));
    fireEvent.change(screen.getByLabelText("下次改进"), { target: { value: "少盐" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    await waitFor(() => expect(mockState.addCookingLogApi).toHaveBeenCalledTimes(1));
    expect(mockState.addCookingLogApi).toHaveBeenCalledWith(7, {
      wifeFeedback: "",
      husbandImprovementNotes: "少盐",
      notes: "",
      wifeRating: 0
    });
  });

  it("reads only the saved list url for back navigation", async () => {
    window.sessionStorage.setItem(
      "recipe-list-return",
      JSON.stringify({ url: "/recipes?query=牛腩", scrollY: 480 })
    );

    render(<RecipeDetail id={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "返回菜谱列表" }));

    expect(mockState.push).toHaveBeenCalledWith("/recipes?query=牛腩");
  });

  it("falls back to /recipes when no saved list url exists", async () => {
    render(<RecipeDetail id={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "返回菜谱列表" }));

    expect(mockState.push).toHaveBeenCalledWith("/recipes");
  });

  it("uses the saved list url after successful delete", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    window.sessionStorage.setItem("recipe-list-return", JSON.stringify({ url: "/recipes?category=家常菜", scrollY: 222 }));

    render(<RecipeDetail id={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));

    await waitFor(() => expect(mockState.deleteRecipeApi).toHaveBeenCalledWith(7));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockState.push).toHaveBeenCalledWith("/recipes?category=家常菜");
  });

  it("falls back to /recipes after successful delete when no saved list url exists", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    cleanup();
    render(<RecipeDetail id={8} />);

    fireEvent.click(await screen.findByRole("button", { name: "更多操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));

    await waitFor(() => expect(mockState.deleteRecipeApi).toHaveBeenCalledWith(8));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockState.push).toHaveBeenCalledWith("/recipes");
  });

  it("shows latest review content and refreshes after a successful new cooking log", async () => {
    mockState.getRecipeApi
      .mockResolvedValueOnce({ recipe: makeRecipe() })
      .mockResolvedValueOnce({
        recipe: makeRecipe({
          cookedCount: 4,
          cookingLogs: [
            {
              id: 2,
              cookedAt: "2026-07-03T19:30:00.000Z",
              wifeFeedback: "更下饭了",
              wifeRating: 5,
              husbandImprovementNotes: "再辣一点",
              notes: ""
            }
          ]
        })
      });

    render(<RecipeDetail id={7} />);

    expect(await screen.findByText("牛腩很软")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "标记做过" }));
    fireEvent.click(screen.getByRole("button", { name: "5 星，超好吃" }));
    fireEvent.change(screen.getByLabelText("老婆评价"), { target: { value: "更下饭了" } });
    fireEvent.change(screen.getByLabelText("下次改进"), { target: { value: "再辣一点" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    expect(await screen.findByText("已保存复盘")).toBeInTheDocument();
    expect(await screen.findByText("更下饭了")).toBeInTheDocument();
    expect(screen.getByText("再辣一点")).toBeInTheDocument();
    expect(screen.getByText("做过 4 次")).toBeInTheDocument();
  });

  it("retries loading after an error", async () => {
    mockState.getRecipeApi.mockRejectedValueOnce(new Error("网络错误")).mockResolvedValueOnce({ recipe: makeRecipe() });

    render(<RecipeDetail id={7} />);

    expect(await screen.findByText("网络错误")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));

    expect(await screen.findByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
    expect(mockState.getRecipeApi).toHaveBeenCalledTimes(2);
  });

  it("scrolls to section anchors via scrollIntoView and never uses window.scrollTo", async () => {
    const scrollIntoView = vi.mocked(window.HTMLElement.prototype.scrollIntoView);
    const scrollTo = vi.mocked(window.scrollTo);

    render(<RecipeDetail id={7} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });

    fireEvent.click(screen.getByRole("button", { name: "步骤" }));
    fireEvent.click(screen.getByRole("button", { name: "备料" }));
    fireEvent.click(screen.getByRole("button", { name: "查看复盘" }));

    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("offers delete in the more menu and keeps the detail visible when deletion fails", async () => {
    mockState.deleteRecipeApi.mockRejectedValueOnce(new Error("删除失败"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RecipeDetail id={7} />);

    fireEvent.click(await screen.findByRole("button", { name: "更多操作" }));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "删除菜谱" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText("删除失败")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
    expect(mockState.push).not.toHaveBeenCalled();
  });
});
