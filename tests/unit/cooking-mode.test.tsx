import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingGuideDrawer } from "@/components/cooking/cooking-guide-drawer";
import { CookingMode } from "@/components/cooking/cooking-mode";

const state = vi.hoisted(() => ({ push: vi.fn(), getRecipe: vi.fn(), addCookingLog: vi.fn(), setFavorite: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/http/api-client", () => ({ getRecipeApi: state.getRecipe, addCookingLogApi: state.addCookingLog, setRecipeFavoriteApi: state.setFavorite }));

const recipe = { id: 7, name: "菠萝咕噜肉", mainCategory: "家常菜", coverImageUrl: null, imageUrls: [], cookedCount: 0, cookTimeMinutes: 30, difficulty: "easy", tags: [], latestWifeFeedback: "", wifeRating: 0, isFavorite: false, sourcePlatform: "xhs", sourceUrl: "", originalTitle: "", shareText: "", tips: "趁热吃", ingredients: [{ name: "里脊肉", amount: "500克", type: "ingredient" }], seasonings: [], steps: [{ order: 1, text: "切好里脊肉" }, { order: 2, text: "下锅翻炒" }], cookingLogs: [] };

describe("cooking mode", () => {
  beforeEach(() => { state.push.mockReset(); state.getRecipe.mockResolvedValue({ recipe }); state.addCookingLog.mockResolvedValue({ ok: true }); state.setFavorite.mockResolvedValue({ isFavorite: true }); window.sessionStorage.clear(); });

  it("requires an explicit guide confirmation before navigating into cooking mode", () => {
    render(<CookingGuideDrawer open recipe={recipe} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /准备好了吗？/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "进入第 1 步" }));
    expect(state.push).toHaveBeenCalledWith("/recipes/7/cook");
  });

  it("loads typed recipe detail, supports undoable step completion, and opens shared review only after finish", async () => {
    render(<CookingMode recipeId={7} />);
    expect(await screen.findByRole("heading", { name: "菠萝咕噜肉" })).toBeInTheDocument();
    const step = screen.getByRole("checkbox", { name: "完成第 1 步：切好里脊肉" });
    fireEvent.click(step); expect(step).toHaveAttribute("data-state", "checked");
    fireEvent.click(step); expect(step).toHaveAttribute("data-state", "unchecked");
    fireEvent.click(step);
    fireEvent.click(screen.getByRole("checkbox", { name: "完成第 2 步：下锅翻炒" }));
    fireEvent.click(screen.getByRole("button", { name: "完成做菜" }));
    expect(await screen.findByRole("heading", { name: "做菜复盘" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4 星，很好吃" }));
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));
    await waitFor(() => expect(state.addCookingLog).toHaveBeenCalledWith(7, expect.objectContaining({ wifeRating: 4 })));
    await waitFor(() => expect(state.getRecipe).toHaveBeenCalledTimes(2));
  });

  it("restores only valid unique completed steps after the real recipe steps load", async () => {
    window.sessionStorage.setItem("cooking-session:7", JSON.stringify({ version: 1, recipeId: 7, currentStepOrder: 2, completedStepOrders: [1, 1, 1], timer: { status: "idle", durationMs: 300000, remainingMs: 300000, deadlineAt: null }, speechEnabled: false }));
    render(<CookingMode recipeId={7} />);

    expect(await screen.findByRole("button", { name: "完成做菜" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下锅翻炒" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("checkbox", { name: "完成第 1 步：切好里脊肉" })).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("checkbox", { name: "完成第 2 步：下锅翻炒" })).toHaveAttribute("data-state", "unchecked");
  });
});
