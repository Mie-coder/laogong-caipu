import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnlockPage from "@/app/unlock/page";
import { FamilyMenu } from "@/components/auth/family-menu";
import { UnlockForm } from "@/components/auth/unlock-form";
import { ApiError } from "@/lib/http/api-error";

const { logoutFamilyApi, refresh, replace, unlockFamilyApi } = vi.hoisted(() => ({
  logoutFamilyApi: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  unlockFamilyApi: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("@/lib/http/api-client", () => ({
  logoutFamilyApi,
  unlockFamilyApi,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("family unlock UI", () => {
  it("uses the canonical transaction page-title token instead of a display title", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const titleRule = css.match(/\.family-unlock-card h1\s*\{[^}]*\}/)?.[0] ?? "";

    expect(titleRule).toContain("font-size: var(--type-page-title);");
    expect(titleRule).not.toMatch(/font-size:\s*(?:2rem|var\(--type-display\))/);
  });

  it("submits the family password once from the real form and returns to the protected page", async () => {
    unlockFamilyApi.mockResolvedValue({ ok: true });
    render(<UnlockForm returnTo="/recipes/7" />);

    const password = screen.getByLabelText("家庭密码");
    fireEvent.change(password, { target: { value: "我们两个人的长密码" } });
    fireEvent.submit(password.closest("form")!);

    await waitFor(() => expect(unlockFamilyApi).toHaveBeenCalledWith("我们两个人的长密码"));
    expect(unlockFamilyApi).toHaveBeenCalledOnce();
    expect(password).toHaveValue("");
    expect(replace).toHaveBeenCalledWith("/recipes/7");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a generic error and clears the password out of rendered output", async () => {
    unlockFamilyApi.mockRejectedValue(new ApiError("invalid_credentials", "家庭密码不正确", 401));
    render(<UnlockForm returnTo="/" />);

    const password = screen.getByLabelText("家庭密码");
    fireEvent.change(password, { target: { value: "不会出现在页面" } });
    fireEvent.click(screen.getByRole("button", { name: "进入老公菜谱" }));

    expect(await screen.findByRole("status")).toHaveTextContent("家庭密码不正确");
    expect(password).toHaveValue("");
    expect(document.body.textContent).not.toContain("不会出现在页面");
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses the shadcn password controls with accessible visibility and Apple press feedback", () => {
    render(<UnlockForm returnTo="/" />);

    const password = screen.getByLabelText("家庭密码");
    const visibility = screen.getByRole("button", { name: "显示密码" });
    const submit = screen.getByRole("button", { name: "进入老公菜谱" });
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveClass("min-h-11");
    expect(visibility).toHaveClass("min-h-11");
    expect(visibility).toHaveAttribute("data-press-feedback", "apple");
    expect(submit).toHaveClass("min-h-11");
    expect(submit).toHaveAttribute("data-press-feedback", "apple");

    fireEvent.click(visibility);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "隐藏密码" })).toBeInTheDocument();
  });

  it("sanitizes the unlock page return path before submitting", async () => {
    unlockFamilyApi.mockResolvedValue({ ok: true });
    render(await UnlockPage({ searchParams: Promise.resolve({ next: "//evil.example/steal" }) }));

    fireEvent.change(screen.getByLabelText("家庭密码"), { target: { value: "我们两个人的长密码" } });
    fireEvent.click(screen.getByRole("button", { name: "进入老公菜谱" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(screen.getByRole("heading", { name: "欢迎回家" })).toBeInTheDocument();
  });
});

describe("family menu", () => {
  it("logs out from the shadcn family menu", async () => {
    logoutFamilyApi.mockResolvedValue({ ok: true });
    render(<FamilyMenu />);

    const trigger = screen.getByRole("button", { name: "家庭菜单" });
    expect(trigger).toHaveClass("min-h-11");
    expect(trigger).toHaveAttribute("data-press-feedback", "apple");
    fireEvent.click(trigger);
    const logout = await screen.findByRole("menuitem", { name: "退出家庭" });
    expect(logout).toHaveClass("min-h-11");
    expect(logout).toHaveAttribute("data-press-feedback", "apple");
    fireEvent.click(logout);

    await waitFor(() => expect(logoutFamilyApi).toHaveBeenCalledOnce());
    expect(replace).toHaveBeenCalledWith("/unlock");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the current page and shows a safe status when logout fails", async () => {
    logoutFamilyApi.mockRejectedValue(new Error("private upstream detail"));
    render(<FamilyMenu />);

    fireEvent.click(screen.getByRole("button", { name: "家庭菜单" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "退出家庭" }));

    expect(await screen.findByRole("status")).toHaveTextContent("退出失败，请稍后重试");
    expect(document.body.textContent).not.toContain("private upstream detail");
    expect(replace).not.toHaveBeenCalled();
  });
});
