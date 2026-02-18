"use client";

import { createContext, useContext, type CSSProperties } from "react";
import type { useActiveRow } from "./use_active_row";

export type DetailSectionContextValue = ReturnType<typeof useActiveRow> & {
  rowGridClassName?: string;
  rowGridStyle?: CSSProperties;
  readOnly?: boolean;
  getFormElement?: () => HTMLElement | null;
};

export const DetailSectionContext =
  createContext<DetailSectionContextValue | null>(null);

export const useDetailSectionContext = () =>
  useContext(DetailSectionContext);
