"use client";

import { useEffect, useState } from "react";

type Theme = "day" | "night";

function readTheme(): Theme {
  if (typeof document === "undefined") return "day";
  return document.documentElement.dataset.theme === "night" ? "night" : "day";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "night" ? "day" : "night";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("hazina.theme", next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "night" ? "Use day mode" : "Use night mode"}
      aria-label={theme === "night" ? "Use day mode" : "Use night mode"}
      className={
        compact
          ? "inline-flex h-10 w-10 items-center justify-center border border-border text-obsidian hover:border-obsidian transition-colors"
          : "btn-ghost !px-4 !py-2"
      }
    >
      <span aria-hidden="true">{theme === "night" ? "☀" : "◐"}</span>
      {!compact && <span>{theme === "night" ? "Day" : "Night"}</span>}
    </button>
  );
}
