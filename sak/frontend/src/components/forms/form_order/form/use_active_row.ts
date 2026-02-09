"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useWatch } from "react-hook-form";

export const useActiveRow = ({
  name,
  focusSelector = '[data-articulo-field="true"]',
}: {
  name: string;
  focusSelector?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const items = useWatch({ name }) as unknown[] | undefined;
  const prevLengthRef = useRef<number>(items?.length ?? 0);

  useEffect(() => {
    const length = items?.length ?? 0;
    if (length > prevLengthRef.current && containerRef.current) {
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
    prevLengthRef.current = length;
  }, [items?.length, focusSelector]);

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

  return { containerRef, activeIndex, setActiveIndex, onContainerClick, onRowClick };
};
