"use client";

import { useState } from "react";
import { House, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutFamilyApi } from "@/lib/http/api-client";

export function FamilyMenu(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await logoutFamilyApi();
      router.replace("/unlock");
      router.refresh();
    } catch {
      setError("退出失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="family-menu">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="v3-family-menu-trigger"
            aria-label="家庭菜单"
            data-press-feedback="apple"
            onClick={() => setOpen(true)}
          >
            <House aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="family-menu-content" align="end">
          <DropdownMenuItem
            disabled={pending}
            data-press-feedback="apple"
            onSelect={() => void logout()}
          >
            <LogOut aria-hidden="true" />
            {pending ? "正在退出…" : "退出家庭"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <p className="family-menu-status" role="status">{error}</p> : null}
    </div>
  );
}
