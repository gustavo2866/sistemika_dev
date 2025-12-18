"use client";

import { useCallback, useState } from "react";

export interface KanbanCommonStateOptions {
  initialSearch?: string;
  initialOwnerFilter?: string;
  storageKey?: string;
}

export interface KanbanCommonState {
  searchValue: string;
  setSearchValue: (value: string) => void;
  ownerFilter: string;
  setOwnerFilter: (value: string) => void;
  collapsedAll: boolean;
  toggleCollapsedAll: () => void;
  isCardCollapsed: (id: string | number | undefined | null) => boolean;
  toggleCardCollapse: (id: string | number | undefined | null) => void;
}

export const useKanbanCommonState = (
  { initialSearch = "", initialOwnerFilter = "todos", storageKey }: KanbanCommonStateOptions = {},
): KanbanCommonState => {
  const getInitialCollapsed = () => {
    if (!storageKey) return false;
    try {
      const saved = localStorage.getItem(`kanban-collapsed-${storageKey}`);
      return saved === 'true';
    } catch {
      return false;
    }
  };
  
  const [searchValue, setSearchValue] = useState(initialSearch);
  const [ownerFilter, setOwnerFilter] = useState(initialOwnerFilter);
  const [collapsedAll, setCollapsedAllInternal] = useState(getInitialCollapsed);
  
  const setCollapsedAll = (value: boolean) => {
    setCollapsedAllInternal(value);
    if (storageKey) {
      try {
        localStorage.setItem(`kanban-collapsed-${storageKey}`, String(value));
      } catch {}
    }
  };
  const [cardCollapseOverrides, setCardCollapseOverrides] = useState<Record<string | number, boolean>>({});

  const normalizeId = (id: string | number | undefined | null) => (id != null ? (typeof id === "number" ? id : String(id)) : null);

  const isCardCollapsed = useCallback(
    (id: string | number | undefined | null) => {
      const normalized = normalizeId(id);
      if (normalized == null) {
        return collapsedAll;
      }
      const override = cardCollapseOverrides[normalized];
      return override ?? collapsedAll;
    },
    [cardCollapseOverrides, collapsedAll],
  );

  const toggleCardCollapse = useCallback(
    (id: string | number | undefined | null) => {
      const normalized = normalizeId(id);
      if (normalized == null) {
        return;
      }
      setCardCollapseOverrides((prev) => {
        const current = prev[normalized];
        const next = !(current ?? collapsedAll);
        const updated = { ...prev, [normalized]: next };
        if (next === collapsedAll) {
          const { [normalized]: _removed, ...rest } = updated;
          return rest;
        }
        return updated;
      });
    },
    [collapsedAll],
  );

  const toggleCollapsedAll = useCallback(() => {
    setCollapsedAll(!collapsedAll);
    setCardCollapseOverrides({});
  }, [collapsedAll]);

  return {
    searchValue,
    setSearchValue,
    ownerFilter,
    setOwnerFilter,
    collapsedAll,
    toggleCollapsedAll,
    isCardCollapsed,
    toggleCardCollapse,
  };
};
