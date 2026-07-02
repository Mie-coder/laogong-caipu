import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingLogSheet } from "@/components/cooking-log-sheet";

describe("CookingLogSheet", () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
  });

  it("disables save until rating or text is provided, then submits quick tags in improvement notes", async () => {
    render(<CookingLogSheet open onClose={onClose} onSubmit={onSubmit} />);

    const saveButton = screen.getByRole("button", { name: "保存复盘" });
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "少盐" }));
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        wifeFeedback: "",
        husbandImprovementNotes: "少盐",
        notes: "",
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
});
