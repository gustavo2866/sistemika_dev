"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  SectionDetailTemplate,
  type SectionDetailTemplateProps,
} from "./section_detail_template";

export type SectionDetailTemplateGridProps = SectionDetailTemplateProps & {
  /**
   * Define the grid template columns once (e.g. "minmax(0,1fr) 80px 110px 70px 28px").
   * It will be converted to the internal grid-cols-[...] format.
   */
  gridTemplateColumns?: string;
};

export const SectionDetailTemplateGrid = ({
  gridTemplateColumns,
  columnsClassName,
  columns,
  ...props
}: SectionDetailTemplateGridProps) => {
  const columnSpecs = useMemo(() => {
    if (!gridTemplateColumns) return [];
    const raw = gridTemplateColumns.trim();
    if (!raw) return [];
    const specs: string[] = [];
    let current = "";
    let depth = 0;
    for (const char of raw) {
      if (char === "(") depth += 1;
      if (char === ")") depth = Math.max(0, depth - 1);
      if (char === " " && depth === 0) {
        if (current.trim()) specs.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    if (current.trim()) specs.push(current.trim());
    return specs;
  }, [gridTemplateColumns]);

  const autoAlignClassName = useMemo(() => {
    if (!gridTemplateColumns || !columns?.length) return undefined;
    const alignClasses: string[] = [];
    const total = Math.min(columns.length, columnSpecs.length || columns.length);
    const hasExplicitAlign = (className?: string) =>
      typeof className === "string" &&
      /(^|\s)text-(left|center|right)($|\s)/.test(className);
    const isFlexibleColumn = (spec?: string) =>
      typeof spec === "string" &&
      (spec.includes("fr") || spec.includes("minmax"));

    for (let i = 0; i < total; i += 1) {
      if (hasExplicitAlign(columns[i]?.className)) continue;
      const align = isFlexibleColumn(columnSpecs[i]) ? "left" : "center";
      const index = i + 1;
      if (align === "center") {
        alignClasses.push(
          `[&>div:nth-of-type(${index})]:text-center`,
          `[&>div:nth-of-type(${index})]:justify-self-center`,
          `[&>div:nth-of-type(${index})_input]:text-center`,
          `[&>div:nth-of-type(${index})_[role=combobox]]:justify-center`,
        );
      } else {
        alignClasses.push(
          `[&>div:nth-of-type(${index})]:text-left`,
        );
      }
    }
    return alignClasses.join(" ");
  }, [gridTemplateColumns, columns, columnSpecs]);

  const resolvedColumnsClassName = useMemo(() => {
    if (!gridTemplateColumns) return columnsClassName;
    const normalized = gridTemplateColumns.trim().replace(/\s+/g, "_");
    const gridClass = `grid-cols-[${normalized}]`;
    return cn(gridClass, columnsClassName, autoAlignClassName);
  }, [gridTemplateColumns, columnsClassName, autoAlignClassName]);

  return (
    <SectionDetailTemplate
      {...props}
      columns={columns}
      columnsClassName={resolvedColumnsClassName}
    />
  );
};
