import { forwardRef } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeList } from "@/components/recipe-list";

const mockState = vi.hoisted(() => {
  const push = vi.fn();
  return {
    push,
    searchParams: new URLSearchParams(),
    listRecipesApi: vi.fn(),
    deleteRecipeApi: vi.fn(),
    reducedMotion: false,
    onExitComplete: undefined as (() => void) | undefined
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockState.push }),
  useSearchParams: () => mockState.searchParams
}));

vi.mock("@/lib/http/api-client", () => ({
  listRecipesApi: mockState.listRecipesApi,
  deleteRecipeApi: mockState.deleteRecipeApi
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMotion = (tag: "div" | "section") =>
    forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
      React.createElement(tag, { ...props, ref }, children)
    );

  return {
    AnimatePresence: ({ children, onExitComplete }: { children: React.ReactNode; onExitComplete?: () => void }) => {
      if (onExitComplete) mockState.onExitComplete = onExitComplete;
      return <>{children}</>;
    },
    motion: {
      div: createMotion("div"),
      section: createMotion("section")
    },
    useReducedMotion: () => mockState.reducedMotion
  };
});

function makeRecipe(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `菜谱 ${id}`,
    mainCategory: "家常菜",
    coverImageUrl: `https://example.com/${id}.jpg`,
    cookedCount: id,
    difficulty: id % 2 === 0 ? "medium" : "easy",
    tags: ["下饭", "快手"],
    latestWifeFeedback: "",
    wifeRating: id + 2,
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

beforeEach(() => {
  mockState.push.mockReset();
  mockState.listRecipesApi.mockReset();
  mockState.deleteRecipeApi.mockReset();
  mockState.reducedMotion = false;
  mockState.onExitComplete = undefined;
  mockState.searchParams = new URLSearchParams();
  mockState.listRecipesApi.mockResolvedValue({ recipes: [] });
  mockState.deleteRecipeApi.mockResolvedValue({ ok: true });
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  Object.defineProperty(window, "scrollY", { value: 240, configurable: true });
  window.scrollTo = vi.fn();
});

describe("RecipeList v2", () => {
  it("renders a featured first result, compact rows, and a visible management action", async () => {
    mockState.listRecipesApi.mockResolvedValue({
      recipes: [
        makeRecipe(1, { name: "番茄炖牛腩" }),
        makeRecipe(2, { name: "蒜香鸡翅" }),
        makeRecipe(3, { name: "清蒸鲈鱼" })
      ]
    });

    render(<RecipeList />);

    expect(await screen.findByText("我的菜谱")).toBeInTheDocument();
    expect(screen.getByText("共 3 道")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "管理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "筛选" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最近做过" })).toBeInTheDocument();
    expect(screen.getAllByText("简单").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "最近更新" })).toBeInTheDocument();

    const featured = screen.getByRole("button", { name: "查看菜谱 番茄炖牛腩" });
    expect(featured.querySelector(".aspect-\\[16\\/9\\]")).not.toBeNull();

    const row = screen.getByRole("button", { name: "查看菜谱 蒜香鸡翅" });
    expect(row.closest(".border-t")).not.toBeNull();
    expect(screen.queryByText("长按进入删除模式")).not.toBeInTheDocument();
  });

  it("forwards live search and sheet filters through listRecipesApi", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1)] });

    render(<RecipeList category="川菜" tag="宴客" />);
    await screen.findByText("共 1 道");

    const search = screen.getByPlaceholderText("搜索菜名");
    fireEvent.change(search, { target: { value: "牛腩" } });

    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "牛腩",
        category: "川菜",
        tag: "宴客",
        difficulty: ""
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "难度 中等" }));

    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "牛腩",
        category: "川菜",
        tag: "宴客",
        difficulty: "medium"
      })
    );
  });

  it("keeps 最近做过 as a local quick filter instead of forwarding query", async () => {
    mockState.listRecipesApi.mockResolvedValue({
      recipes: [
        makeRecipe(1, { name: "红烧肉", cookedCount: 3 }),
        makeRecipe(2, { name: "凉拌黄瓜", cookedCount: 0 })
      ]
    });

    render(<RecipeList />);
    await screen.findByText("共 2 道");

    fireEvent.click(screen.getByRole("button", { name: "最近做过" }));

    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "",
        category: "",
        tag: "",
        difficulty: ""
      })
    );

    expect(screen.getByRole("button", { name: "查看菜谱 红烧肉" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看菜谱 凉拌黄瓜" })).not.toBeInTheDocument();
  });

  it("clears query and all filters when 全部 is selected", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1)] });

    render(<RecipeList />);
    await screen.findByText("共 1 道");

    fireEvent.change(screen.getByPlaceholderText("搜索菜名"), { target: { value: "排骨" } });
    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "排骨",
        category: "",
        tag: "",
        difficulty: ""
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "分类 家常菜" }));
    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "排骨",
        category: "家常菜",
        tag: "",
        difficulty: ""
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "难度 中等" }));
    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "排骨",
        category: "家常菜",
        tag: "",
        difficulty: "medium"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "全部" }));

    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "",
        category: "",
        tag: "",
        difficulty: ""
      })
    );
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
  });

  it("clears the 最近做过 quick filter when 全部 is selected", async () => {
    mockState.listRecipesApi.mockResolvedValue({
      recipes: [
        makeRecipe(1, { name: "番茄炖牛腩", cookedCount: 2 }),
        makeRecipe(2, { name: "凉拌黄瓜", cookedCount: 0 })
      ]
    });

    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 番茄炖牛腩" });

    fireEvent.click(screen.getByRole("button", { name: "最近做过" }));
    expect(screen.queryByRole("button", { name: "查看菜谱 凉拌黄瓜" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    expect(await screen.findByRole("button", { name: "查看菜谱 凉拌黄瓜" })).toBeInTheDocument();
  });

  it("keeps filter choices visible from the initial unfiltered snapshot", async () => {
    mockState.listRecipesApi
      .mockResolvedValueOnce({
        recipes: [
          makeRecipe(1, { mainCategory: "家常菜", tags: ["下饭"] }),
          makeRecipe(2, { mainCategory: "汤羹", tags: ["清淡"] })
        ]
      })
      .mockResolvedValue({ recipes: [makeRecipe(1, { mainCategory: "家常菜", tags: ["下饭"] })] });

    render(<RecipeList />);
    await screen.findByText("共 2 道");

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "分类 家常菜" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "分类 汤羹" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "标签 下饭" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "标签 清淡" })).toBeInTheDocument();
  });

  it("clears prop-derived category and tag filters from the sheet", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1, { mainCategory: "川菜", tags: ["宴客"] })] });

    render(<RecipeList category="川菜" tag="宴客" />);
    await screen.findByText("共 1 道");

    expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
      query: "",
      category: "川菜",
      tag: "宴客",
      difficulty: ""
    });

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "分类 全部" }));
    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "",
        category: "",
        tag: "宴客",
        difficulty: ""
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "标签 全部" }));
    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "",
        category: "",
        tag: "",
        difficulty: ""
      })
    );
  });

  it("shows a safe-area delete bar with disabled delete when no recipes are selected", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1), makeRecipe(2)] });

    render(<RecipeList />);
    await screen.findByText("共 2 道");

    fireEvent.click(screen.getByRole("button", { name: "管理" }));

    const deleteButton = screen.getByRole("button", { name: "删除已选" });
    const managementBar = screen.getByRole("button", { name: "退出管理" }).closest(".fixed");
    expect(deleteButton).toBeDisabled();
    expect(screen.getByText("已选 0 道")).toBeInTheDocument();
    expect(managementBar).toHaveClass("z-[35]");
    expect(managementBar).not.toHaveClass("z-40");
  });

  it("positions the featured selection badge inside a relative wrapper", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1, { name: "番茄炖牛腩" }), makeRecipe(2)] });

    render(<RecipeList />);
    await screen.findByText("共 2 道");

    fireEvent.click(screen.getByRole("button", { name: "管理" }));

    const featuredButton = screen.getByRole("button", { name: "选择菜谱 番茄炖牛腩" });
    const featuredWrapper = featuredButton.parentElement;

    expect(featuredWrapper?.className).toContain("relative");
    expect(featuredWrapper?.querySelector(".absolute.right-0.top-4")).not.toBeNull();
  });

  it("confirms deletion, keeps failed selections, and shows an actionable error", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1), makeRecipe(2)] });
    mockState.deleteRecipeApi.mockRejectedValueOnce(new Error("删除失败"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RecipeList />);
    await screen.findByText("共 2 道");

    fireEvent.click(screen.getByRole("button", { name: "管理" }));
    fireEvent.click(screen.getByRole("button", { name: "选择菜谱 菜谱 2" }));
    fireEvent.click(screen.getByRole("button", { name: "删除已选" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockState.deleteRecipeApi).toHaveBeenCalledWith(2);
    await waitFor(() => expect(screen.getAllByText("删除失败，请重试").length).toBeGreaterThan(0));
    expect(screen.getByText("已选 1 道")).toBeInTheDocument();
  });

  it("shows concise empty and error states while preserving filters and query", async () => {
    mockState.listRecipesApi
      .mockResolvedValueOnce({ recipes: [] })
      .mockRejectedValueOnce(new Error("请求失败"));

    const { rerender } = render(<RecipeList />);
    expect(await screen.findByText("还没有菜谱")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去导入" })).toBeInTheDocument();

    const search = screen.getByPlaceholderText("搜索菜名");
    fireEvent.change(search, { target: { value: "排骨" } });

    await waitFor(() =>
      expect(mockState.listRecipesApi).toHaveBeenLastCalledWith({
        query: "排骨",
        category: "",
        tag: "",
        difficulty: ""
      })
    );

    rerender(<RecipeList />);

    expect(await screen.findByText("加载失败，请重试")).toBeInTheDocument();
    expect(screen.getByDisplayValue("排骨")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("stores list return state before navigation to detail", async () => {
    mockState.listRecipesApi.mockResolvedValue({ recipes: [makeRecipe(1, { name: "番茄炖牛腩" })] });

    render(<RecipeList category="家常菜" tag="下饭" />);
    fireEvent.click(await screen.findByRole("button", { name: "查看菜谱 番茄炖牛腩" }));

    expect(mockState.push).toHaveBeenCalledWith("/recipes/1");
    expect(JSON.parse(window.sessionStorage.getItem("recipe-list-return") ?? "{}")).toEqual({
      url: "/recipes?category=%E5%AE%B6%E5%B8%B8%E8%8F%9C&tag=%E4%B8%8B%E9%A5%AD",
      scrollY: 240
    });
  });

  it("restores scroll exactly once after the loading layout finishes exiting", async () => {
    const request = deferred<{ recipes: ReturnType<typeof makeRecipe>[] }>();
    window.sessionStorage.setItem(
      "recipe-list-return",
      JSON.stringify({ url: "/recipes?query=%E7%89%9B", scrollY: 512 })
    );
    mockState.searchParams = new URLSearchParams("query=牛");
    mockState.listRecipesApi.mockReturnValue(request.promise);

    render(<RecipeList />);

    expect(window.scrollTo).not.toHaveBeenCalled();

    request.resolve({ recipes: [makeRecipe(1, { name: "牛肉汤" })] });

    await screen.findByRole("button", { name: "查看菜谱 牛肉汤" });
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(mockState.onExitComplete).toBeTypeOf("function");

    act(() => mockState.onExitComplete?.());

    expect(window.scrollTo).toHaveBeenCalledWith(0, 512);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    act(() => mockState.onExitComplete?.());
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });
});
