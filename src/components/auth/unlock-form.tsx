"use client";

import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/http/api-error";
import { unlockFamilyApi } from "@/lib/http/api-client";

export function UnlockForm({ returnTo }: { returnTo: string }): JSX.Element {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !password) return;

    submittingRef.current = true;
    setPending(true);
    setError("");
    try {
      await unlockFamilyApi(password);
      setPassword("");
      router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      setPassword("");
      setError(cause instanceof ApiError ? cause.message : "解锁失败，请稍后重试");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form className="family-unlock-form" onSubmit={(event) => void submit(event)}>
      <div className="family-unlock-field">
        <Label htmlFor="family-password">家庭密码</Label>
        <div className="family-unlock-input-wrap">
          <Input
            id="family-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
            value={password}
            disabled={pending}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="family-unlock-visibility"
            aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
            data-press-feedback="apple"
            disabled={pending}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <p className="family-unlock-status" role={error ? "status" : undefined} aria-live="polite">
        {error}
      </p>
      <Button
        type="submit"
        className="family-unlock-submit"
        data-loading={pending ? "true" : undefined}
        data-press-feedback="apple"
        disabled={pending || !password}
      >
        {pending ? <LoaderCircle className="family-unlock-spinner" aria-hidden="true" /> : null}
        {pending ? "正在进入…" : "进入老公菜谱"}
      </Button>
    </form>
  );
}
