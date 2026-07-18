"use client";

import { Minus, Pause, Play, Plus, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookingTimer } from "@/hooks/use-cooking-timer";
import type { CookingTimerState } from "@/lib/domain/cooking-session";

function timeLabel(remainingMs: number) { const seconds = Math.ceil(remainingMs / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

export function CookingTimer({ timer, onChange }: { timer: CookingTimerState; onChange: (timer: CookingTimerState) => void }) {
  const controls = useCookingTimer(timer, onChange);
  const action = timer.status === "running" ? { label: "暂停计时", icon: Pause, onClick: controls.pause } : timer.status === "paused" ? { label: "继续计时", icon: Play, onClick: controls.resume } : timer.status === "finished" ? { label: "重新计时", icon: RotateCcw, onClick: controls.start } : { label: "开始计时", icon: Play, onClick: controls.start };
  const Icon = action.icon;
  return <section className="cooking-timer" aria-label="烹饪计时"><span className="sr-only" role="status">{timer.status === "finished" ? "计时结束" : `计时${timer.status === "running" ? "进行中" : "已暂停"}`}</span><div className="cooking-timer-controls"><Button variant="secondary" size="icon" aria-label="减少时间" data-press-feedback="apple" onClick={() => controls.adjust(-60_000)}><Minus aria-hidden="true" /></Button><p><span>计时</span><strong>{timeLabel(controls.remainingMs)}</strong></p><Button variant="secondary" size="icon" aria-label="增加时间" data-press-feedback="apple" onClick={() => controls.adjust(60_000)}><Plus aria-hidden="true" /></Button></div><div className="cooking-timer-actions"><Button variant="outline" size="icon" aria-label="结束计时" data-press-feedback="apple" onClick={controls.finish}><Square aria-hidden="true" /></Button><Button size="icon" aria-label={action.label} data-press-feedback="apple" onClick={action.onClick}><Icon aria-hidden="true" /></Button></div></section>;
}
