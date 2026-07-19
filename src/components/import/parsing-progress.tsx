"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const labels = [
  ["识别分享内容", "已确认分享来源"],
  ["读取菜谱正文", "正在提取正文和标题"],
  ["整理食材和步骤", "正在核对用量与顺序"],
  ["筛选菜谱图片", "将保留适合做菜的图片"]
] as const;
type ParsingProgressProps = { step: 0 | 1 | 2 | 3; source: string; onCancel: () => void };

export function ParsingProgress({ step, source, onCancel }: ParsingProgressProps) {
  const reduceMotion = useReducedMotion();
  return <main data-testid="import-parsing-page" data-transaction-screen="true" className="import-parsing-page mx-auto min-h-dvh max-w-[430px] px-5 pt-12">
    <h1 className="import-parsing-title">正在解析</h1><p className="import-parsing-estimate">预计只需几秒钟</p><section className="import-parsing-source-card"><p>解析来源</p><strong>{source}</strong></section>
    <ol aria-label="解析进度" className="import-parsing-timeline mt-12 grid gap-6">
      {labels.map(([label, description], index) => <li key={label} data-testid="import-parsing-step" className={`import-parsing-step ${index < step ? "is-done" : ""} ${index === step ? "is-current" : ""}`}>
        <span className="import-parsing-step-marker"><span className="import-parsing-step-node">{index < step ? <Check /> : index === step ? <LoaderCircle className={reduceMotion ? "text-primary" : "animate-spin text-primary"} /> : null}</span></span><span><strong>{label}</strong><small>{description}</small></span>
      </li>)}
    </ol>
    <p role="status" className="import-parsing-live-status">正在安全保存你的输入，请稍候。</p>
    <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="import-parsing-cancel" data-press-feedback="apple">取消解析</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>取消这次解析？</AlertDialogTitle><AlertDialogDescription>已粘贴的分享文本会保留在导入抽屉中。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-press-feedback="apple">继续解析</AlertDialogCancel><AlertDialogAction data-press-feedback="apple" onClick={onCancel}>取消解析</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
