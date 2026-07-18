import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "@/components/recipe/favorite-button";
import { RecipeDetail } from "@/components/recipe-detail";
import { ApiError } from "@/lib/http/api-error";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  getRecipe: vi.fn(),
  addCookingLog: vi.fn(),
  deleteRecipe: vi.fn(),
  setFavorite: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/http/api-client", () => ({
  getRecipeApi: state.getRecipe,
  addCookingLogApi: state.addCookingLog,
  deleteRecipeApi: state.deleteRecipe,
  setRecipeFavoriteApi: state.setFavorite
}));

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 7, name: "番茄炖牛腩", mainCategory: "家常菜", coverImageUrl: "https://images.example/cover.jpg",
    cookedCount: 3, cookTimeMinutes: 45, difficulty: "medium", tags: ["下饭"], latestWifeFeedback: "", wifeRating: 4.8,
    isFavorite: false, sourcePlatform: "xhs", sourceUrl: "", originalTitle: "", shareText: "", tips: "番茄先炒出沙。",
    imageUrls: ["https://images.example/cover.jpg"], ingredients: [{ name: "牛腩", amount: "500克", type: "ingredient" }], seasonings: [],
    steps: [{ order: 1, text: "牛腩焯水后炖煮。", imageUrl: null }],
    cookingLogs: [{ id: 1, cookedAt: "2026-07-18T19:30:00.000Z", wifeFeedback: "很香", wifeRating: 4, husbandImprovementNotes: "少盐", notes: "" }],
    ...overrides
  };
}

beforeEach(() => {
  state.push.mockReset(); state.getRecipe.mockReset(); state.addCookingLog.mockReset(); state.deleteRecipe.mockReset(); state.setFavorite.mockReset();
  window.sessionStorage.clear();
  state.getRecipe.mockResolvedValue({ recipe: makeRecipe() }); state.addCookingLog.mockResolvedValue({ ok: true }); state.deleteRecipe.mockResolvedValue({ ok: true }); state.setFavorite.mockResolvedValue({ isFavorite: true });
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

describe("Recipe detail V3", () => {
  it("optimistically saves a recipe-specific favorite target and rolls it back visibly on failure", async () => {
    const changed = vi.fn();
    const { rerender } = render(<FavoriteButton recipeId={7} recipeName="番茄炖牛腩" isFavorite={false} onChanged={changed} />);
    const button = screen.getByRole("button", { name: "收藏菜谱 番茄炖牛腩" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(state.setFavorite).toHaveBeenCalledWith(7, true));
    expect(changed).toHaveBeenCalledWith(true);

    state.setFavorite.mockRejectedValueOnce(new Error("收藏失败"));
    rerender(<FavoriteButton recipeId={7} recipeName="番茄炖牛腩" isFavorite onChanged={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "取消收藏菜谱 番茄炖牛腩" }));
    expect(await screen.findByRole("status")).toHaveTextContent("收藏失败");
    expect(screen.getByRole("button", { name: "取消收藏菜谱 番茄炖牛腩" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders full ingredient and step tabs, image fallback, typed cooking start, and delete confirmation", async () => {
    const startCooking = vi.fn();
    render(<RecipeDetail id={7} onStartCooking={startCooking} />);
    expect(await screen.findByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
    expect(screen.getByText("家常菜 · 45 分钟 · 中等 · 做过 3 次")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "食材" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "步骤" }));
    expect(screen.getByRole("tab", { name: "步骤" })).toHaveAttribute("aria-selected", "true");
    fireEvent.error(screen.getByRole("img", { name: "番茄炖牛腩 菜谱封面" }));
    expect(screen.getByText("图片加载失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始做菜" }));
    expect(startCooking).toHaveBeenCalledWith(7);

    fireEvent.keyDown(screen.getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "删除菜谱" }));
    await waitFor(() => expect(state.deleteRecipe).toHaveBeenCalledWith(7));
  });

  it("renders only wired edit and cooking actions, then calls their typed handlers", async () => {
    const startCooking = vi.fn(); const editRecipe = vi.fn();
    const { rerender } = render(<RecipeDetail id={7} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    expect(screen.queryByRole("button", { name: "编辑菜谱" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始做菜" })).not.toBeInTheDocument();

    rerender(<RecipeDetail id={7} onStartCooking={startCooking} onEditRecipe={editRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: "编辑菜谱" }));
    fireEvent.click(screen.getByRole("button", { name: "开始做菜" }));
    expect(editRecipe).toHaveBeenCalledWith(7);
    expect(startCooking).toHaveBeenCalledWith(7);
  });

  it("separates a missing recipe from a retryable load failure", async () => {
    state.getRecipe.mockRejectedValueOnce(new ApiError("not_found", "菜谱不存在", 404));
    const { rerender } = render(<RecipeDetail id={7} />);
    expect(await screen.findByRole("heading", { name: "菜谱没找到" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();

    state.getRecipe.mockRejectedValueOnce(new ApiError("http_error", "网络错误", 500)).mockResolvedValueOnce({ recipe: makeRecipe() });
    rerender(<RecipeDetail id={8} />);
    expect(await screen.findByRole("heading", { name: "加载失败" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
  });

  it("returns to the saved list after delete and safely falls back for missing or invalid saved state", async () => {
    window.sessionStorage.setItem("recipe-list-return", JSON.stringify({ url: "/recipes?query=%E7%89%9B%E8%85%A9" }));
    const { rerender } = render(<RecipeDetail id={7} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    fireEvent.keyDown(screen.getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "删除菜谱" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/recipes?query=%E7%89%9B%E8%85%A9"));

    state.push.mockReset(); window.sessionStorage.setItem("recipe-list-return", "坏数据");
    rerender(<RecipeDetail id={8} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    fireEvent.click(screen.getByRole("button", { name: "返回菜谱列表" }));
    expect(state.push).toHaveBeenCalledWith("/recipes");

    state.push.mockReset(); window.sessionStorage.removeItem("recipe-list-return");
    rerender(<RecipeDetail id={9} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    fireEvent.click(screen.getByRole("button", { name: "返回菜谱列表" }));
    expect(state.push).toHaveBeenCalledWith("/recipes");
  });

  it("keeps detail visible and reports a failed delete without navigation", async () => {
    state.deleteRecipe.mockRejectedValueOnce(new Error("删除失败"));
    render(<RecipeDetail id={7} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    fireEvent.keyDown(screen.getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "删除菜谱" }));
    expect(await screen.findByRole("status")).toHaveTextContent("删除失败");
    expect(screen.getByRole("heading", { name: "番茄炖牛腩" })).toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();
  });

  it("marks all detail and review control paths for Apple pointer-down feedback", async () => {
    render(<RecipeDetail id={7} onStartCooking={vi.fn()} onEditRecipe={vi.fn()} />);
    await screen.findByRole("heading", { name: "番茄炖牛腩" });
    for (const name of ["返回菜谱列表", "收藏菜谱 番茄炖牛腩", "编辑菜谱", "更多操作", "开始做菜", "查看复盘"]) expect(screen.getByRole("button", { name })).toHaveAttribute("data-press-feedback", "apple");
    fireEvent.click(screen.getByRole("button", { name: "查看复盘" }));
    const close = await screen.findByRole("button", { name: "关闭" });
    expect(close).toHaveAttribute("data-press-feedback", "apple");
    expect(screen.getByRole("button", { name: "4 星，很好吃" })).toHaveAttribute("data-press-feedback", "apple");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("button", { name: "关闭" })).not.toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole("button", { name: "更多操作" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除菜谱" }));
    expect(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "删除菜谱" })).toHaveAttribute("data-press-feedback", "apple");
  });

  it("shows a retryable load error and refreshes latest review after a successful saved review", async () => {
    state.getRecipe.mockRejectedValueOnce(new Error("网络错误")).mockResolvedValueOnce({ recipe: makeRecipe() }).mockResolvedValueOnce({ recipe: makeRecipe({ cookedCount: 4, cookingLogs: [{ id: 2, cookedAt: "2026-07-19T19:30:00.000Z", wifeFeedback: "更下饭了", wifeRating: 5, husbandImprovementNotes: "再辣一点", notes: "" }] }) });
    render(<RecipeDetail id={7} />);
    expect(await screen.findByText("网络错误")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("button", { name: "查看复盘" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看复盘" }));
    fireEvent.change(await screen.findByLabelText("老婆评价"), { target: { value: "更下饭了" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));
    await waitFor(() => expect(state.addCookingLog).toHaveBeenCalledWith(7, expect.objectContaining({ wifeFeedback: "更下饭了" })));
    await waitFor(() => expect(state.getRecipe).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("更下饭了")).toBeInTheDocument();
    expect(screen.getByText(/做过 4 次/)).toBeInTheDocument();
  });
});
