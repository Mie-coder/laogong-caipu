"use client";

import { CheckCircle2, Clipboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ImportSheetProps = {
  open: boolean;
  rawInput: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onInputChange: (rawInput: string) => void;
  onPaste: () => void;
  onSubmit: () => void;
};

export function ImportSheet({ open, rawInput, error, onOpenChange, onInputChange, onPaste, onSubmit }: ImportSheetProps) {
  return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="v3-import-drawer mx-auto max-w-[430px] px-5">
      <DrawerHeader className="import-sheet-header relative px-0 text-center"><DrawerTitle>导入菜谱</DrawerTitle><Button variant="ghost" size="icon" aria-label="关闭" className="absolute right-0 top-0" onClick={() => onOpenChange(false)}><X /></Button></DrawerHeader>
      <DrawerDescription className="import-sheet-lead text-center">粘贴小红书分享文字即可自动解析</DrawerDescription>
      <div className="flex min-h-[52vh] flex-col gap-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
        <div className="grid gap-2"><Label htmlFor="import-share-text">分享文字</Label><Textarea id="import-share-text" aria-label="分享文本" className="import-sheet-textarea" value={rawInput} onChange={(event) => onInputChange(event.target.value)} placeholder="粘贴小红书分享文字、短链或正文片段" /></div>
        <p className="import-sheet-paste-hint"><Clipboard aria-hidden="true" />支持长按粘贴，关闭后文字会保留</p>
        {rawInput ? <p className="import-sheet-success-hint"><CheckCircle2 aria-hidden="true" />已识别到分享文字</p> : null}
        <Button variant="ghost" className="sr-only" aria-label="从剪贴板粘贴" onClick={onPaste}>从剪贴板粘贴</Button>
        <div className="mt-auto grid gap-3">{error ? <p role="alert" className="import-sheet-error text-sm text-destructive">{error}</p> : null}<Button className="import-sheet-submit" disabled={!rawInput.trim()} onClick={onSubmit}>开始解析</Button></div>
      </div>
    </DrawerContent>
  </Drawer>;
}
