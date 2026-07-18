"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function Toast({ message }: { message: string }) {
  const previous = useRef("");

  useEffect(() => {
    if (message && message !== previous.current) toast(message);
    previous.current = message;
  }, [message]);
  return null;
}
