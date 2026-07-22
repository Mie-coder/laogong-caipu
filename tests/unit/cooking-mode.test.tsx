import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingGuideDrawer } from "@/components/cooking/cooking-guide-drawer";
import { CookingMode } from "@/components/cooking/cooking-mode";

const state = vi.hoisted(() => ({ push: vi.fn(), getRecipe: vi.fn(), addCookingLog: vi.fn(), setFavorite: vi.fn(), requestIngredientImage: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/http/api-client", () => ({ getRecipeApi: state.getRecipe, addCookingLogApi: state.addCookingLog, setRecipeFavoriteApi: state.setFavorite, requestIngredientImageApi: state.requestIngredientImage }));

const recipe = { id: 7, name: "菠萝咕噜肉", mainCategory: "家常菜", coverImageUrl: null, imageUrls: [], cookedCount: 0, cookTimeMinutes: 30, difficulty: "easy", tags: [], latestWifeFeedback: "", wifeRating: 0, isFavorite: false, sourcePlatform: "xhs", sourceUrl: "", originalTitle: "", shareText: "", tips: "趁热吃", ingredients: [{ name: "里脊肉", amount: "500克", type: "ingredient" }], seasonings: [], steps: [{ order: 1, text: "切好里脊肉" }, { order: 2, text: "下锅翻炒" }], cookingLogs: [] };

describe("cooking mode", () => {
  beforeEach(() => { state.push.mockReset(); state.getRecipe.mockReset(); state.addCookingLog.mockReset(); state.setFavorite.mockReset(); state.requestIngredientImage.mockReset(); state.getRecipe.mockResolvedValue({ recipe }); state.addCookingLog.mockResolvedValue({ ok: true }); state.setFavorite.mockResolvedValue({ isFavorite: true }); state.requestIngredientImage.mockResolvedValue({ key: "a".repeat(64), imageUrl: "/api/ingredient-images/cached" }); window.sessionStorage.clear(); });

  it("loads a server-controlled image for a visible ingredient and keeps the text fallback", async () => {
    state.requestIngredientImage.mockResolvedValue({ key: "a".repeat(64), imageUrl: "/api/ingredient-images/cached" });
    render(<CookingMode recipeId={7} />);
    expect(await screen.findByText("里脊肉")).toBeInTheDocument();
    await waitFor(() => expect(state.requestIngredientImage).toHaveBeenCalledWith(7, "ingredient", 0, expect.any(AbortSignal)));
    expect(await screen.findByTestId("ingredient-image-ingredient-0")).toHaveAttribute("src", "/api/ingredient-images/cached");
    expect(screen.getByText("里")).toBeInTheDocument();
  });

  it("replaces an aborted Strict Mode request and renders the ingredient image", async () => {
    let firstSignal: AbortSignal | undefined;
    state.requestIngredientImage
      .mockImplementationOnce((_recipeId: number, _kind: string, _index: number, signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      })
      .mockResolvedValue({ key: "b".repeat(64), imageUrl: "/api/ingredient-images/strict-replacement" });

    render(<React.StrictMode><CookingMode recipeId={7} /></React.StrictMode>);
    expect(await screen.findByText("里脊肉")).toBeInTheDocument();
    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    await waitFor(() => expect(state.requestIngredientImage.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByTestId("ingredient-image-ingredient-0")).toHaveAttribute("src", "/api/ingredient-images/strict-replacement");
  });

  it("keeps the ingredient fallback available when image generation fails", async () => {
    state.requestIngredientImage.mockRejectedValue(new Error("image unavailable"));
    render(<CookingMode recipeId={7} />);

    expect(await screen.findByText("里脊肉")).toBeInTheDocument();
    await waitFor(() => expect(state.requestIngredientImage).toHaveBeenCalledWith(7, "ingredient", 0, expect.any(AbortSignal)));
    expect(screen.getByText("500克")).toBeInTheDocument();
    expect(screen.getByText("里")).toBeInTheDocument();
    expect(screen.queryByTestId("ingredient-image-ingredient-0")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the ingredient skeleton visible until the browser image load event", async () => {
    let resolveImage: ((value: { key: string; imageUrl: string }) => void) | undefined;
    state.requestIngredientImage.mockImplementation(() => new Promise((resolve) => { resolveImage = resolve; }));

    render(<CookingMode recipeId={7} />);
    expect(await screen.findByText("里脊肉")).toBeInTheDocument();
    await waitFor(() => expect(state.requestIngredientImage).toHaveBeenCalled());

    const avatar = screen.getByText("里").closest(".cooking-ingredient-avatar");
    expect(avatar).toHaveAttribute("aria-busy", "true");
    expect(avatar).toHaveClass("is-loading");
    expect(screen.getByText("正在生成里脊肉图片")).toHaveClass("sr-only");

    resolveImage?.({ key: "a".repeat(64), imageUrl: "/api/ingredient-images/generated" });
    const image = await screen.findByTestId("ingredient-image-ingredient-0");
    expect(image).toHaveAttribute("src", "/api/ingredient-images/generated");
    expect(avatar).toHaveAttribute("aria-busy", "true");
    fireEvent.load(image);
    expect(avatar).toHaveAttribute("aria-busy", "false");
    expect(avatar).not.toHaveClass("is-loading");
    fireEvent.error(image);
    expect(screen.queryByTestId("ingredient-image-ingredient-0")).not.toBeInTheDocument();
    expect(avatar).toHaveAttribute("aria-busy", "false");
    expect(avatar).toHaveClass("is-failed");
    expect(screen.getByText("里")).toBeInTheDocument();
  });

  it("toggles all ingredients ready and then clears the whole selection", async () => {
    state.getRecipe.mockResolvedValue({ recipe: { ...recipe, ingredients: [...recipe.ingredients, { name: "青椒", amount: "1 个", type: "ingredient" }] } });
    render(<CookingMode recipeId={7} />);
    expect(await screen.findByText("里脊肉")).toBeInTheDocument();
    expect(await screen.findByText("青椒")).toBeInTheDocument();

    const ingredient = screen.getByText("里脊肉").closest("button");
    const secondIngredient = screen.getByText("青椒").closest("button");
    expect(ingredient).not.toBeNull();
    expect(secondIngredient).not.toBeNull();
    expect(screen.getByRole("button", { name: "全部勾选" })).toHaveAttribute("aria-pressed", "false");
    expect(ingredient).toHaveAttribute("aria-pressed", "false");
    expect(secondIngredient).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(ingredient!);
    expect(ingredient).toHaveAttribute("aria-pressed", "true");
    expect(secondIngredient).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "全部勾选" }));
    expect(ingredient).toHaveAttribute("aria-pressed", "true");
    expect(secondIngredient).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "取消全选" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "取消全选" }));
    expect(ingredient).toHaveAttribute("aria-pressed", "false");
    expect(secondIngredient).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "全部勾选" })).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores an observer callback queued before the ingredient card unmounts", async () => {
    const observe = vi.fn();
    let callback: IntersectionObserverCallback | undefined;
    const IntersectionObserverMock = vi.fn(function (nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
      return { observe, disconnect: vi.fn(), takeRecords: vi.fn(() => []), unobserve: vi.fn() };
    });
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    try {
      const { unmount } = render(<CookingMode recipeId={7} />);
      expect(await screen.findByText("里脊肉")).toBeInTheDocument();
      await waitFor(() => expect(observe).toHaveBeenCalledTimes(1));

      unmount();
      callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

      expect(state.requestIngredientImage).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("observes the complete ingredient card within the horizontal rail", async () => {
    const observe = vi.fn();
    let options: IntersectionObserverInit | undefined;
    const IntersectionObserverMock = vi.fn(function (_callback: IntersectionObserverCallback, nextOptions?: IntersectionObserverInit) {
      options = nextOptions;
      return { observe, disconnect: vi.fn(), takeRecords: vi.fn(() => []), unobserve: vi.fn() };
    });
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    try {
      render(<CookingMode recipeId={7} />);
      expect(await screen.findByText("里脊肉")).toBeInTheDocument();
      await waitFor(() => expect(observe).toHaveBeenCalledTimes(1));

      const rail = document.querySelector<HTMLDivElement>(".cooking-ingredient-rail");
      const card = rail?.querySelector<HTMLButtonElement>(".cooking-ingredient");
      expect(card).not.toBeNull();
      expect(observe).toHaveBeenCalledWith(card);
      expect(options).toEqual({ root: rail, rootMargin: "0px 96px" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("requires an explicit guide confirmation before navigating into cooking mode", () => {
    render(<CookingGuideDrawer open recipe={recipe} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /准备好了吗？/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "进入第 1 步" }));
    expect(state.push).toHaveBeenCalledWith("/recipes/7/cook");
  });

  it("replaces a rejected remote guide cover with the bundled fallback", () => {
    render(<CookingGuideDrawer open recipe={{ ...recipe, coverImageUrl: "https://sns-webpic-qc.xhscdn.com/expired.jpg" }} onOpenChange={vi.fn()} />);
    const image = screen.getByRole("img", { name: "菠萝咕噜肉 成品图" });
    expect(image).toHaveAttribute("src", "https://sns-webpic-qc.xhscdn.com/expired.jpg");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/stitch-v3/stitch-image-20.jpg");
  });

  it("loads typed recipe detail, supports undoable step completion, and opens shared review only after finish", async () => {
    render(<CookingMode recipeId={7} />);
    expect(await screen.findByRole("heading", { name: "菠萝咕噜肉" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 1 步：切好里脊肉" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("切好里脊肉").closest("li")).toHaveClass("is-completed");
    fireEvent.click(screen.getByRole("button", { name: "撤销完成第 1 步：切好里脊肉" }));
    expect(screen.getByText("0 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 1 步：切好里脊肉" }));
    fireEvent.click(screen.getByRole("button", { name: "完成第 2 步：下锅翻炒" }));
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
    expect(screen.getByRole("button", { name: "完成第 2 步：下锅翻炒" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "撤销完成第 1 步：切好里脊肉" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "完成第 2 步：下锅翻炒" })).toHaveAttribute("aria-pressed", "false");
  });
});
