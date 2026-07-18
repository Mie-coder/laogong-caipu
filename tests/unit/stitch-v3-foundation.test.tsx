import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import fs from "node:fs";
import path from "node:path";

describe("Stitch V3 foundation", () => {
  it("exposes the shadcn button with a 44px touch target", () => {
    render(<Button aria-label="收藏">收藏</Button>);
    expect(screen.getByRole("button", { name: "收藏" })).toHaveClass("min-h-11");
  });

  it("closes the Drawer wrapper and restores the trigger contract", () => {
    const onClose = vi.fn();
    render(<BottomSheet open title="导入菜谱" onClose={onClose}>内容</BottomSheet>);
    expect(screen.getByRole("dialog", { name: "导入菜谱" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("gives every generated interactive primitive a 44px hit target", () => {
    render(
      <>
        <Input aria-label="菜名" />
        <Textarea aria-label="备注" />
        <Checkbox aria-label="完成" />
        <Tabs defaultValue="ingredients">
          <TabsList><TabsTrigger value="ingredients">食材</TabsTrigger></TabsList>
        </Tabs>
        <Dialog open><DialogContent><DialogTitle>确认</DialogTitle></DialogContent></Dialog>
        <DropdownMenu open><DropdownMenuTrigger>更多</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <AlertDialog open><AlertDialogContent><AlertDialogTitle>删除菜谱</AlertDialogTitle><AlertDialogAction>继续</AlertDialogAction><AlertDialogCancel>取消</AlertDialogCancel></AlertDialogContent></AlertDialog>
      </>
    );

    for (const control of [
      screen.getByLabelText("菜名"),
      screen.getByLabelText("完成"),
      screen.getByRole("tab", { name: "食材", hidden: true }),
      screen.getByRole("button", { name: "Close", hidden: true }),
      screen.getByRole("menuitem", { name: "删除", hidden: true }),
      screen.getByRole("button", { name: "继续", hidden: true }),
      screen.getByRole("button", { name: "取消", hidden: true }),
    ]) {
      expect(control).toHaveClass("min-h-11");
    }

    expect(screen.getByLabelText("完成")).toHaveClass("min-w-11");
    expect(screen.getByLabelText("备注")).toHaveClass("min-h-[60px]");
    expect(screen.getByRole("button", { name: "Close", hidden: true })).toHaveClass("min-w-11");
  });

  it("keeps the 16px Checkbox visual styled from its checked Root state", () => {
    render(<Checkbox aria-label="完成" />);

    const checkbox = screen.getByLabelText("完成");
    const visual = checkbox.firstElementChild;

    expect(visual).toHaveClass("h-4", "w-4");
    fireEvent.click(checkbox);
    expect(checkbox).toHaveAttribute("data-state", "checked");
    expect(visual).toHaveClass("group-data-[state=checked]:bg-primary", "group-data-[state=checked]:text-primary-foreground");
  });

  it("maps destructive foreground as a Tailwind color token", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "tailwind.config.ts"), "utf8");

    expect(config).toMatch(/destructive:\s*\{\s*DEFAULT: "hsl\(var\(--destructive\)\)",\s*foreground: "hsl\(var\(--destructive-foreground\)\)",/s);
  });
});
