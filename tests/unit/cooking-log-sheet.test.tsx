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

  it("disables save until rating or text is provided, then submits notes in the payload", async () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    const saveButton = screen.getByRole("button", { name: "保存复盘" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "这次火候稳住了" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        wifeFeedback: "",
        husbandImprovementNotes: "",
        notes: "这次火候稳住了",
        wifeRating: 0
      })
    );
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

  it("does not render quick tag toggles", () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.queryByRole("button", { name: "少盐" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "火小一点" })).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "留着观察口感" } });
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
    fireEvent.change(screen.getByLabelText("备注"), { target: { value: "下次继续" } });
    fireEvent.click(screen.getByRole("button", { name: "保存复盘" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    rerender(<CookingLogSheet open={false} onClose={onClose} onSubmit={onSubmit} />);
    rerender(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.queryByDisplayValue("香")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("下次继续")).not.toBeInTheDocument();
  });
});
