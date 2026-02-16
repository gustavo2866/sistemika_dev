"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useFormState, useWatch } from "react-hook-form";

export const useActiveRow = ({
  name,
  focusSelector = '[data-focus-field="true"]',
}: {
  name: string;
  focusSelector?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const items = useWatch({ name }) as unknown[] | undefined;
  const { dirtyFields } = useFormState();
  const isArrayDirty = Boolean((dirtyFields as any)?.[name]);
  const prevLengthRef = useRef<number>(items?.length ?? 0);
  const hasSeenItemsRef = useRef(false);
  const autoActivateRef = useRef(false);

  const requestAutoActivate = useCallback(() => {
    autoActivateRef.current = true;
  }, []);

  useEffect(() => {
    const length = items?.length ?? 0;
    if (!hasSeenItemsRef.current) {
      if (items == null) return;
      hasSeenItemsRef.current = true;
      prevLengthRef.current = length;
      if (length > 0 && isArrayDirty && containerRef.current && autoActivateRef.current) {
        autoActivateRef.current = false;
        setActiveIndex(length - 1);
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        const container = containerRef.current;
        window.setTimeout(() => {
          const fields = container.querySelectorAll(focusSelector);
          const last = fields[fields.length - 1];
          const focusTarget =
            (last?.querySelector('[role="combobox"]') as HTMLElement | null) ??
            (last?.querySelector("input") as HTMLElement | null) ??
            (last as HTMLElement | null);
          focusTarget?.focus();
        }, 0);
      }
      return;
    }
    if (length > prevLengthRef.current && containerRef.current) {
      if (!autoActivateRef.current) {
        prevLengthRef.current = length;
        return;
      }
      autoActivateRef.current = false;
      setActiveIndex(length - 1);
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      const container = containerRef.current;
      window.setTimeout(() => {
        const fields = container.querySelectorAll(focusSelector);
        const last = fields[fields.length - 1];
        const focusTarget =
          (last?.querySelector('[role="combobox"]') as HTMLElement | null) ??
          (last?.querySelector("input") as HTMLElement | null) ??
          (last as HTMLElement | null);
        focusTarget?.focus();
      }, 0);
    }
    if (length < prevLengthRef.current) {
      setActiveIndex(null);
    }
    prevLengthRef.current = length;
  }, [items, focusSelector, isArrayDirty]);

  const onContainerClick = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const onRowClick = useCallback(
    (index: number) => (event: MouseEvent) => {
      event.stopPropagation();
      setActiveIndex(index);
    },
    [],
  );

  return {
    containerRef,
    activeIndex,
    setActiveIndex,
    onContainerClick,
    onRowClick,
    requestAutoActivate,
  };
};
