"use client";

import { createContext, useContext } from "react";

export type DetailRowContextValue = {
  isActive: boolean;
  showOptional: boolean;
  toggleOptional: () => void;
  collapse: () => void;
  remove: () => void;
};

const DetailRowContext = createContext<DetailRowContextValue | null>(null);

export const DetailRowProvider = DetailRowContext.Provider;

export const useDetailRowContext = () => {
  const context = useContext(DetailRowContext);
  if (!context) {
    throw new Error("DetailRowContext must be used within DetailRowProvider");
  }
  return context;
};
