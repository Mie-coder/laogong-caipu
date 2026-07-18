import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingLogSheet } from "@/components/cooking-log-sheet";

vi.mock("@/components/bottom-sheet", () => ({
  BottomSheet: ({
    open,
    title,
    onClose,
    children
  }: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          关闭
        </button>
        {children}
      </div>
    ) : null
}));

describe("CookingLogSheet", () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
  });

  it("disables save until rating, text, or a quick tag is provided, then submits the review payload", async () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    const saveButton = screen.getByRole("button", { name: "保存复盘" });
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "少盐" }));
    fireEvent.change(screen.getByLabelText("下次改进"), { target: { value: "番茄可以再多放一个" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        wifeFeedback: "",
        husbandImprovementNotes: "少盐，番茄可以再多放一个",
        notes: "",
        wifeRating: 0
      })
    );
  });

  it("matches the 1:1 cooking review sheet design contract", () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByRole("heading", { name: "做菜复盘" })).toBeInTheDocument();
    expect(screen.getByText("记录下来，下次会做得更好")).toBeInTheDocument();
    expect(document.querySelector(".cook-review-form")).not.toBeNull();
    expect(document.querySelector(".cook-review-stars")).not.toBeNull();
    expect(document.querySelectorAll(".cook-review-star-button")).toHaveLength(5);
    expect(document.querySelector(".cook-review-feedback")).not.toBeNull();
    expect(document.querySelector(".cook-review-tags")).not.toBeNull();
    expect(document.querySelectorAll(".cook-review-tag")).toHaveLength(4);
    expect(document.querySelector(".cook-review-time-row")).not.toBeNull();
    expect(document.querySelector(".cook-review-submit")).not.toBeNull();
  });

  it("shows a lucide star rating control and keeps the selected label in sync", () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "4 星，很好吃" }));

    expect(screen.getByText("很好吃")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4 星，很好吃" }).querySelector("svg")).not.toBeNull();
  });

  it("preserves user input when submit fails", async () => {
    onSubmit.mockRejectedValueOnce(new Error("保存失败"));

    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "5 星，超好吃" }));
    fireEvent.change(screen.getByLabelText("老婆评价"), { target: { value: "很好吃" } });
    fireEvent.change(screen.getByLabelText("下次改进"), { target: { value: "再辣一点" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    expect(await screen.findByText("保存失败")).toBeInTheDocument();
    expect(screen.getByDisplayValue("很好吃")).toBeInTheDocument();
    expect(screen.getByDisplayValue("再辣一点")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders quick tag toggles and marks the selected improvement tag", () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    const lessSalt = screen.getByRole("button", { name: "少盐" });
    expect(lessSalt).toHaveClass("cook-review-tag");
    fireEvent.click(lessSalt);

    expect(lessSalt).toHaveClass("is-selected");
    expect(screen.getByRole("button", { name: "火小一点" })).toBeInTheDocument();
  });

  it("shows the current cooking time row without submitting a fake cookedAt field", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 8, 19, 30, 0));

    try {
      render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

      expect(screen.getByText("今天 19:30")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "4 星，很好吃" }));
      fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("cookedAt");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores close while submitting and keeps fields visible", async () => {
    let resolveSubmit: (() => void) | undefined;
    onSubmit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("老婆评价"), { target: { value: "留着观察口感" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("留着观察口感")).toBeInTheDocument();

    resolveSubmit?.();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("resets fields after a successful submit and close cycle", async () => {
    const { rerender } = render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("老婆评价"), { target: { value: "香" } });
    fireEvent.change(screen.getByLabelText("下次改进"), { target: { value: "下次继续" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    rerender(<CookingLogSheet open={false} onClose={onClose} onSubmit={onSubmit} />);
    rerender(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.queryByDisplayValue("香")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("下次继续")).not.toBeInTheDocument();
  });
});
