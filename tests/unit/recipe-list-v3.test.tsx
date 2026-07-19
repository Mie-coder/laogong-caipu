import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeListResponseSchema } from "@/lib/domain/recipe-api";
import { RecipeCard } from "@/components/recipe-card";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RecipeList } from "@/components/recipe-list";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
  pathname: "/recipes",
  recipes: vi.fn(),
  remove: vi.fn(),
  setFavorite: vi.fn(),
  toastError: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.search),
  usePathname: () => state.pathname
}));

vi.mock("@/lib/http/api-client", () => ({
  listRecipesApi: state.recipes,
  deleteRecipeApi: state.remove,
  setRecipeFavoriteApi: state.setFavorite
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function recipe(id: number, overrides: Record<string, unknown> = {}) {
  return { id, name: `菜谱 ${id}`, mainCategory: "家常菜", coverImageUrl: null, cookedCount: id, cookTimeMinutes: 30, difficulty: "easy", tags: ["快手"], latestWifeFeedback: "", wifeRating: 4, isFavorite: false, ...overrides };
}

beforeEach(() => {
  state.push.mockReset();
  state.replace.mockReset();
  state.search = "";
  state.pathname = "/recipes";
  state.recipes.mockReset().mockResolvedValue({ recipes: [] });
  state.remove.mockReset().mockResolvedValue({ ok: true });
  state.setFavorite.mockReset().mockResolvedValue({ isFavorite: true });
  state.toastError.mockReset();
  window.sessionStorage.clear();
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stitch V3 recipe list contract", () => {
  it("normalizes a legacy list response to an explicit favorite state", () => {
    const result = RecipeListResponseSchema.parse({ recipes: [{
      id: 1, name: "菠萝咕噜肉", mainCategory: "家常菜", coverImageUrl: null,
      cookedCount: 0, cookTimeMinutes: 30, difficulty: "easy", tags: [],
      latestWifeFeedback: "", wifeRating: 0
    }] });
    expect(result.recipes[0]?.isFavorite).toBe(false);
  });

  it("has an accessible recipe navigation action and shared favorite control", () => {
    render(<RecipeCard recipe={RecipeListResponseSchema.parse({ recipes: [{ id: 1, name: "菠萝咕噜肉", mainCategory: "家常菜", coverImageUrl: null, cookedCount: 0, cookTimeMinutes: 30, difficulty: "easy", tags: [], latestWifeFeedback: "", wifeRating: 0 }] }).recipes[0]!} />);
    expect(screen.getByRole("button", { name: "查看菜谱 菠萝咕噜肉" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收藏菜谱 菠萝咕噜肉" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders V3 list structure with categories and the local recent segment", async () => {
    state.recipes.mockResolvedValue({ recipes: [{
      id: 3, name: "蒜香鸡翅", mainCategory: "家常菜", coverImageUrl: null,
      cookedCount: 2, cookTimeMinutes: 30, difficulty: "easy", tags: ["快手"],
      latestWifeFeedback: "", wifeRating: 4.5, isFavorite: false
    }] });
    render(<RecipeList />);
    expect(await screen.findByRole("heading", { name: "我的菜谱" })).toBeInTheDocument();
    expect(screen.getByText("收藏的每一道，都能认真做完")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "菜谱" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索" })).toHaveClass("v3-list-header-button");
    expect(screen.getByRole("button", { name: "更多" })).toHaveClass("v3-list-header-button");
    expect(within(screen.getByLabelText("分类筛选")).getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最近做过" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看菜谱 蒜香鸡翅" }));
    expect(state.push).toHaveBeenCalledWith("/recipes/3");
    expect(screen.getByRole("button", { name: "收藏菜谱 蒜香鸡翅" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "导入新菜谱" })).toHaveAttribute("href", "/");
  });

  it("forwards search and server filters, while recent cooking stays local", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1), recipe(2, { cookedCount: 0 })] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索菜名" }), { target: { value: "鸡翅" } });
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(expect.objectContaining({ query: "鸡翅" }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "最近做过" }));
    expect(screen.queryByRole("button", { name: "查看菜谱 菜谱 2" })).not.toBeInTheDocument();
    expect(state.recipes).toHaveBeenLastCalledWith(expect.objectContaining({ query: "鸡翅" }), expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.click(await screen.findByRole("button", { name: "难度 简单" }));
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: "easy" }), expect.any(AbortSignal)));
  });

  it("hydrates complete URL filters and synchronizes changes through replace", async () => {
    state.search = "query=%E9%B8%A1%E7%BF%85&category=%E5%AE%B6%E5%B8%B8%E8%8F%9C&tag=%E5%BF%AB%E6%89%8B&difficulty=easy&recent=cooked";
    state.recipes.mockResolvedValue({ recipes: [recipe(1)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    expect(state.recipes).toHaveBeenCalledWith({ query: "鸡翅", category: "家常菜", tag: "快手", difficulty: "easy" }, expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "最近做过" })).toHaveAttribute("aria-pressed", "true");
    expect(state.replace).toHaveBeenCalledWith(expect.stringContaining("recent=cooked"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索菜名" }), { target: { value: "排骨" } });
    await waitFor(() => expect(state.replace).toHaveBeenLastCalledWith(expect.stringContaining("query=%E6%8E%92%E9%AA%A8"), { scroll: false }));
  });

  it("clears every server and local filter from the 全部 chip", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1, { mainCategory: "川菜", tags: ["宴客"] })] });
    render(<RecipeList category="川菜" tag="宴客" />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索菜名" }), { target: { value: "鸡翅" } });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.click(await screen.findByRole("button", { name: "难度 简单" }));
    fireEvent.click(screen.getByRole("button", { name: "最近做过" }));
    fireEvent.click(within(screen.getByLabelText("分类筛选")).getByRole("button", { name: "全部" }));
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(
      { query: "", category: "", tag: "", difficulty: "" },
      expect.any(AbortSignal)
    ));
    expect(screen.getByRole("button", { name: "最近做过" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps failed selections in management mode after real delete attempts", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1), recipe(2)] });
    state.remove.mockImplementation((id: number) => id === 2 ? Promise.reject(new Error("offline")) : Promise.resolve({ ok: true }));
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "管理菜谱" }));
    fireEvent.click(screen.getByRole("button", { name: "选择菜谱 菜谱 1" }));
    fireEvent.click(screen.getByRole("button", { name: "选择菜谱 菜谱 2" }));
    fireEvent.click(screen.getByRole("button", { name: "删除已选" }));
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => expect(state.remove).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "选择菜谱 菜谱 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择菜谱 菜谱 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("删除失败，请重试")).toBeInTheDocument();
  });

  it("opens a real 更多 menu before entering management", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: "管理菜谱" })).toBeInTheDocument();
    expect(screen.queryByLabelText("菜谱管理")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "管理菜谱" }));
    expect(screen.getByLabelText("菜谱管理")).toBeInTheDocument();
  });

  it("clears a delete failure after a successful retry", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1)] });
    state.remove.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "管理菜谱" }));
    fireEvent.click(screen.getByRole("button", { name: "选择菜谱 菜谱 1" }));
    fireEvent.click(screen.getByRole("button", { name: "删除已选" }));
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));
    expect(await screen.findByText("删除失败，请重试")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除已选" }));
    fireEvent.click(await screen.findByRole("button", { name: "删除" }));
    await waitFor(() => expect(screen.queryByText("删除失败，请重试")).not.toBeInTheDocument());
  });

  it("opens management with one preselected recipe after a 500ms long press", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1), recipe(2)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByRole("button", { name: "查看菜谱 菜谱 1" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByLabelText("菜谱管理")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择菜谱 菜谱 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.pointerUp(screen.getByRole("button", { name: "选择菜谱 菜谱 1" }));
    fireEvent.click(screen.getByRole("button", { name: "选择菜谱 菜谱 1" }));
    expect(state.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "选择菜谱 菜谱 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "退出管理" }));
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "管理菜谱" }));
    expect(screen.getByRole("button", { name: "删除已选" })).toBeDisabled();
  });

  it("has empty/error/retry states and restores saved scroll before detail navigation", async () => {
    state.recipes.mockResolvedValueOnce({ recipes: [] }).mockResolvedValueOnce({ recipes: [recipe(9)] });
    render(<RecipeList />);
    expect(await screen.findByRole("link", { name: "去导入" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.click(await screen.findByRole("button", { name: "难度 简单" }));
    await screen.findByRole("button", { name: "查看菜谱 菜谱 9" });
    fireEvent.click(screen.getByRole("button", { name: "查看菜谱 菜谱 9" }));
    expect(state.push).toHaveBeenCalledWith("/recipes/9");
    expect(JSON.parse(window.sessionStorage.getItem("recipe-list-return") ?? "{}")).toMatchObject({ url: "/recipes?difficulty=easy" });
  });

  it("preserves prop filters and clears both prop-derived category and tag filters", async () => {
    state.recipes.mockResolvedValue({ recipes: [recipe(1, { mainCategory: "川菜", tags: ["宴客"] }), recipe(2, { mainCategory: "汤羹", tags: ["清淡"] })] });
    render(<RecipeList category="川菜" tag="宴客" />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    expect(state.recipes).toHaveBeenLastCalledWith({ query: "", category: "川菜", tag: "宴客", difficulty: "" }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(await screen.findByRole("button", { name: "分类 汤羹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标签 清淡" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "分类 全部" }));
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(expect.objectContaining({ category: "", tag: "宴客" }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.click(await screen.findByRole("button", { name: "标签 全部" }));
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(
      { query: "", category: "", tag: "", difficulty: "" },
      expect.any(AbortSignal)
    ));
  });

  it("restores the saved scroll once for the matching route and makes categories actionable", async () => {
    window.sessionStorage.setItem("recipe-list-return", JSON.stringify({ url: "/recipes", scrollY: 512 }));
    state.recipes.mockResolvedValue({ recipes: [recipe(1, { mainCategory: "川菜" })] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 512));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("tab", { name: "分类" }));
    fireEvent.click(screen.getByRole("button", { name: /川菜 1/ }));
    await waitFor(() => expect(state.recipes).toHaveBeenLastCalledWith(expect.objectContaining({ category: "川菜" }), expect.any(AbortSignal)));
    expect(screen.getByRole("tab", { name: "菜谱" })).toHaveAttribute("aria-selected", "true");
  });

  it("restores an expanded search control before scrolling a matching list route", async () => {
    window.sessionStorage.setItem("recipe-list-return", JSON.stringify({ url: "/recipes", scrollY: 512, searchOpen: true }));
    let searchWasOpenAtRestore = false;
    window.scrollTo = vi.fn(() => { searchWasOpenAtRestore = document.querySelector(".v3-list-search")?.classList.contains("is-open") ?? false; });
    state.recipes.mockResolvedValue({ recipes: [recipe(1)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 512));
    expect(searchWasOpenAtRestore).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("does not restore scroll from a different list route", async () => {
    window.sessionStorage.setItem("recipe-list-return", JSON.stringify({ url: "/recipes?query=排骨", scrollY: 512 }));
    state.recipes.mockResolvedValue({ recipes: [recipe(1)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps query/filter state and retries with the same typed request parameters", async () => {
    state.recipes.mockResolvedValueOnce({ recipes: [recipe(1)] }).mockResolvedValueOnce({ recipes: [recipe(1)] }).mockRejectedValueOnce(new Error("网络开小差了")).mockResolvedValueOnce({ recipes: [recipe(8)] });
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 菜谱 1" });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    fireEvent.click(await screen.findByRole("button", { name: "难度 简单" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索菜名" }), { target: { value: "排骨" } });
    expect(await screen.findByText("网络开小差了")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await screen.findByRole("button", { name: "查看菜谱 菜谱 8" });
    expect(screen.getByDisplayValue("排骨")).toBeInTheDocument();
    expect(state.recipes).toHaveBeenLastCalledWith(
      { query: "排骨", category: "", tag: "", difficulty: "easy" },
      expect.any(AbortSignal)
    );
  });

  it("refreshes in the foreground without hiding cards and keeps the last success on failure", async () => {
    let now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const refreshed = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    state.recipes
      .mockResolvedValueOnce({ recipes: [recipe(1, { name: "旧菜谱" })] })
      .mockReturnValueOnce(refreshed.promise)
      .mockRejectedValueOnce(new Error("offline"));
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 旧菜谱" });

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "查看菜谱 旧菜谱" })).toBeInTheDocument();
    expect(screen.queryByLabelText("菜谱加载中")).not.toBeInTheDocument();

    act(() => refreshed.resolve({ recipes: [recipe(2, { name: "共享新菜谱" })] }));
    expect(await screen.findByRole("button", { name: "查看菜谱 共享新菜谱" })).toBeInTheDocument();

    now += 1_001;
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith("同步失败，已保留当前菜谱"));
    expect(screen.getByRole("button", { name: "查看菜谱 共享新菜谱" })).toBeInTheDocument();
    expect(screen.queryByText("offline")).not.toBeInTheDocument();
  });

  it("uses initial error semantics when focus replaces a pending first request and then fails", async () => {
    const initial = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    const replacement = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    state.recipes.mockReturnValueOnce(initial.promise).mockReturnValueOnce(replacement.promise);
    render(<RecipeList />);
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(1));
    const initialSignal = state.recipes.mock.calls[0]?.[1] as AbortSignal;

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(2));
    expect(initialSignal.aborted).toBe(true);
    act(() => replacement.reject(new Error("初始同步失败")));

    expect(await screen.findByText("初始同步失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(screen.queryByText("还没有菜谱")).not.toBeInTheDocument();
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it("does not reuse a successful snapshot from a different query for background failure semantics", async () => {
    const changedQuery = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    const replacement = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    state.recipes
      .mockResolvedValueOnce({ recipes: [recipe(1, { name: "旧查询菜谱" })] })
      .mockReturnValueOnce(changedQuery.promise)
      .mockReturnValueOnce(replacement.promise);
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 旧查询菜谱" });
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索菜名" }), { target: { value: "新查询" } });
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(2));

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(3));
    act(() => replacement.reject(new Error("新查询同步失败")));

    expect(await screen.findByText("新查询同步失败")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看菜谱 旧查询菜谱" })).not.toBeInTheDocument();
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it("treats a successful empty list as the current query snapshot", async () => {
    state.recipes.mockResolvedValueOnce({ recipes: [] }).mockRejectedValueOnce(new Error("offline"));
    render(<RecipeList />);
    expect(await screen.findByRole("link", { name: "去导入" })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith("同步失败，已保留当前菜谱"));
    expect(screen.getByRole("link", { name: "去导入" })).toBeInTheDocument();
    expect(screen.queryByText("offline")).not.toBeInTheDocument();
  });

  it("aborts an older list refresh and ignores its late response", async () => {
    let now = 20_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const older = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    const latest = deferred<{ recipes: ReturnType<typeof recipe>[] }>();
    state.recipes
      .mockResolvedValueOnce({ recipes: [recipe(1, { name: "初始菜谱" })] })
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(latest.promise);
    render(<RecipeList />);
    await screen.findByRole("button", { name: "查看菜谱 初始菜谱" });

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(2));
    const olderSignal = state.recipes.mock.calls[1]?.[1] as AbortSignal;
    now += 1_001;
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(state.recipes).toHaveBeenCalledTimes(3));
    expect(olderSignal.aborted).toBe(true);

    act(() => latest.resolve({ recipes: [recipe(3, { name: "最新菜谱" })] }));
    await screen.findByRole("button", { name: "查看菜谱 最新菜谱" });
    act(() => older.resolve({ recipes: [recipe(2, { name: "过期菜谱" })] }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "查看菜谱 过期菜谱" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "查看菜谱 最新菜谱" })).toBeInTheDocument();
  });
});
