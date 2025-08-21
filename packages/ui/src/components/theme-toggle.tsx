"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "./button";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const mode = (theme ?? resolvedTheme) === "dark" ? "dark" : "light";
  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(nextMode)}>
      {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
    </Button>
  );
}
