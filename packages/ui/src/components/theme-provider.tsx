"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // No forzamos nada aquí; lo configurás en la app.
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
