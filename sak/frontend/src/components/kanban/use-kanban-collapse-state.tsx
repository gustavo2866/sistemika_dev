"use client";

import { useCallback, useState } from "react";

export const useKanbanCollapseState = <K extends string>(initialState: Record<K, boolean>) => {
  const [collapsed, setCollapsed] = useState<Record<K, boolean>>(initialState);

  const toggle = useCallback((bucketKey: K) => {
    setCollapsed((prev) => ({ ...prev, [bucketKey]: !prev[bucketKey] }));
  }, []);

  const setCollapsedState = useCallback((bucketKey: K, value: boolean) => {
    setCollapsed((prev) => ({ ...prev, [bucketKey]: value }));
  }, []);

  return {
    collapsed,
    setCollapsed,
    setCollapsedState,
    toggle,
  };
};
