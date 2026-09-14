"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Pressing "/" anywhere (outside inputs) jumps to the search page. Renders nothing. */
export function SearchShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || pathname === "/search") return;
      e.preventDefault();
      router.push("/search");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);
  return null;
}
