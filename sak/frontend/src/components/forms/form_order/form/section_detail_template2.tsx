"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, PlusCircle, Trash } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useSimpleFormIteratorItem } from "ra-core";

import { DetailFieldIndexProvider } from "./detail_field_cell";
import { SectionCard } from "./section_card";
import { useActiveRow } from "./use_active_row";
import { DetailSectionContext, useDetailSectionContext } from "./detail_section_context";
import { DetailFooterButtons } from "./detail_footer_buttons";
import { DetailIterator } from "./detail_iterator";
import { DetailRowActions } from "./detail_row_actions";
import { DetailRowError } from "./detail_row_error";
import { DetailRowProvider } from "./detail_row_context";
import { HiddenInput } from "./hidden_input";
import { ResponsiveDetailRow } from "./responsive_detail_row";
import { ArrayInput } from "@/components/array-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";

export type SectionDetailColumn = {
  label: string;
  width?: string;
  className?: string;
  mobileSpan?: number | "full";
};

export type SectionDetailFieldsProps = {
  isActive: boolean;
};

export type SectionDetailTemplate2Props = {
  title: string;
  detailsSource?: string;
  mainColumns: SectionDetailColumn[];
  mainFields: ComponentType<SectionDetailFieldsProps>;
  optionalFields?: ComponentType<SectionDetailFieldsProps>;
  defaults: () => Record<string, unknown>;
  actions?: ReactNode;
  defaultOpen?: boolean;
  focusSelector?: string;
  maxHeightClassName?: string;
  onActiveRowChange?: (activeIndex: number | null) => void;
  readOnly?: boolean;
};

type DetailItemRowProps = {
  MainFields: ComponentType<SectionDetailFieldsProps>;
  OptionalFields?: ComponentType<SectionDetailFieldsProps>;
  columns: SectionDetailColumn[];
};

const DetailItemRow = ({ MainFields, OptionalFields, columns }: DetailItemRowProps) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("DetailItemRow must be used within SectionDetailTemplate2");
  }
  const { rowGridClassName, rowGridStyle, activeIndex, onRowClick, setActiveIndex } =
    detailContext;
  const [showOptional, setShowOptional] = useState(false);
  const { remove, index } = useSimpleFormIteratorItem();
  const isActive = !detailContext.readOnly && activeIndex === index;
  const hasOptional = Boolean(OptionalFields);

  const handleCollapse = () => {
    setShowOptional(false);
    setActiveIndex(null);
  };
  const toggleOptional = () => setShowOptional((prev) => !prev);

  useEffect(() => {
    if (detailContext.readOnly) return;
    if (!isActive && showOptional) {
      setShowOptional(false);
    }
  }, [isActive, showOptional, detailContext.readOnly]);

  const rowClassName = cn(
    isActive
      ? "is-active border-primary/30 bg-primary/5 sm:border sm:border-primary/30 sm:bg-primary/5 sm:rounded-md sm:p-2"
      : "sm:border-transparent",
  );

  return (
    <DetailRowProvider
      value={{
        isActive,
        showOptional,
        toggleOptional,
        collapse: handleCollapse,
        remove,
      }}
    >
      <ResponsiveDetailRow className={rowClassName} onClick={onRowClick(index)}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 sm:block">
          <div
            className={cn(
              "grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1 sm:items-center sm:gap-2",
              rowGridClassName,
            )}
            style={rowGridStyle}
          >
            <HiddenInput source="id" />
            <DetailFieldIndexProvider
              mobileSpans={columns.map((column) => column.mobileSpan)}
            >
              <MainFields isActive={isActive} />
            </DetailFieldIndexProvider>
            <DetailRowActions
              mode="desktop"
              readOnly={detailContext.readOnly}
              forceVisible={detailContext.readOnly}
              showInfo={hasOptional}
            />
            <DetailRowError />
          </div>
          <div className="flex items-end justify-end self-end sm:hidden">
            <DetailRowActions
              mode="mobile"
              readOnly={detailContext.readOnly}
              forceVisible={detailContext.readOnly}
              showInfo={hasOptional}
            />
          </div>
        </div>
        {OptionalFields && showOptional ? (
          <OptionalFields isActive={isActive} />
        ) : null}
        <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
      </ResponsiveDetailRow>
    </DetailRowProvider>
  );
};

export const SectionDetailTemplate2 = ({
  title,
  detailsSource = "detalles",
  mainColumns,
  mainFields: MainFields,
  optionalFields: OptionalFields,
  defaults,
  actions,
  defaultOpen = true,
  focusSelector,
  maxHeightClassName,
  onActiveRowChange,
  readOnly = false,
}: SectionDetailTemplate2Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { getValues, setValue } = useFormContext();
  const activeRow = useActiveRow({ name: detailsSource, focusSelector });
  const disableAdd = readOnly || activeRow.activeIndex != null;
  const detalles = useWatch({ name: detailsSource }) as unknown[] | undefined;
  const hasDetails = (detalles ?? []).length > 0;

  const gridTemplateColumns = useMemo(() => {
    if (!mainColumns?.length) return undefined;
    return mainColumns
      .map((column) => {
        const raw = column.width?.trim();
        return raw && raw.length > 0 ? raw : "minmax(0,1fr)";
      })
      .join(" ");
  }, [mainColumns]);

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
    if (!gridTemplateColumns || !mainColumns?.length) return undefined;
    const alignClasses: string[] = [];
    const total = Math.min(mainColumns.length, columnSpecs.length || mainColumns.length);
    const hasExplicitAlign = (className?: string) =>
      typeof className === "string" &&
      /(^|\s)text-(left|center|right)($|\s)/.test(className);
    const isFlexibleColumn = (spec?: string) =>
      typeof spec === "string" &&
      (spec.includes("fr") || spec.includes("minmax"));

    for (let i = 0; i < total; i += 1) {
      if (hasExplicitAlign(mainColumns[i]?.className)) continue;
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
  }, [gridTemplateColumns, mainColumns, columnSpecs]);

  const resolvedColumnsClassName = useMemo(() => {
    if (!gridTemplateColumns) return autoAlignClassName;
    const normalized = gridTemplateColumns.trim().replace(/\s+/g, "_");
    const gridClass = `grid-cols-[${normalized}]`;
    return cn(gridClass, autoAlignClassName);
  }, [gridTemplateColumns, autoAlignClassName]);

  const gridTemplate = useMemo(() => {
    const raw = gridTemplateColumns?.trim();
    return raw ? raw : undefined;
  }, [gridTemplateColumns]);

  const columnsClassNameSansGrid = useMemo(() => {
    if (!resolvedColumnsClassName) return undefined;
    return resolvedColumnsClassName.replace(/grid-cols-\[[^\]]+\]/g, "").trim();
  }, [resolvedColumnsClassName]);

  const rowGridStyle = useMemo(() => {
    if (!gridTemplate) return undefined;
    return { ["--detail-grid" as any]: gridTemplate } as CSSProperties;
  }, [gridTemplate]);

  const rowGridClassName = useMemo(() => {
    if (!gridTemplate) return columnsClassNameSansGrid;
    return cn(
      "sm:[grid-template-columns:var(--detail-grid)]",
      columnsClassNameSansGrid,
    );
  }, [gridTemplate, columnsClassNameSansGrid]);

  const getDefaultValues = () => (defaults ? defaults() : {});

  const handleAdd = () => {
    if (readOnly) return;
    const current = (getValues(detailsSource) as unknown[]) ?? [];
    const nextItem = getDefaultValues();
    activeRow.requestAutoActivate();
    setValue(detailsSource, [...current, nextItem], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleClear = () => {
    if (readOnly) return;
    setValue(detailsSource, [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const handleContainerClick = () => {
    // Intentionally no-op: exiting edit mode is handled explicitly via row actions
  };

  const handleRowClick = useMemo(
    () => (index: number) => (event: MouseEvent) => {
      if (readOnly) {
        event.stopPropagation();
        return;
      }
      activeRow.onRowClick(index)(event);
    },
    [readOnly, activeRow.onRowClick],
  );

  useEffect(() => {
    onActiveRowChange?.(activeRow.activeIndex ?? null);
    return () => {
      onActiveRowChange?.(null);
    };
  }, [activeRow.activeIndex, onActiveRowChange]);

  const toggleButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-5 w-5 text-muted-foreground"
      tabIndex={-1}
      onClick={() => setIsOpen((v) => !v)}
      aria-label={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
      title={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
    >
      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </Button>
  );

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground"
          tabIndex={-1}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          className="gap-2 text-[9px] sm:text-[10px]"
          onClick={() => {
            if (disableAdd) return;
            handleAdd();
          }}
          disabled={disableAdd}
        >
          <PlusCircle className="h-3 w-3" />
          Agregar
        </DropdownMenuItem>
        {hasDetails && !readOnly ? (
          <DropdownMenuItem
            className="gap-2 text-[9px] sm:text-[10px]"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash className="h-3 w-3 text-destructive" />
            Limpiar
          </DropdownMenuItem>
        ) : null}
        {actions ? <DropdownMenuSeparator /> : null}
        {actions}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {actionsMenu}
      {toggleButton}
    </div>
  );

  return (
    <SectionCard
      title={title}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      headerTabIndex={-1}
      headerActions={headerActions}
      cardClassName="pt-3"
      contentClassName="px-2 pt-0 pb-1"
      titleClassName="mb-0"
    >
      {mainColumns?.length ? (
        <div
          className={cn(
            "hidden sm:grid sm:gap-2 mt-2 text-[10px] font-semibold text-foreground pb-0 px-2",
            rowGridClassName,
          )}
          style={rowGridStyle}
        >
          {mainColumns.map((column, index) => (
            <div key={`${column.label}-${index}`} className={column.className}>
              {column.label}
            </div>
          ))}
        </div>
      ) : null}
      <DetailSectionContext.Provider
        value={{
          ...activeRow,
          onContainerClick: handleContainerClick,
          onRowClick: handleRowClick,
          rowGridClassName,
          rowGridStyle,
          readOnly,
        }}
      >
        <div className="mt-1 space-y-0 w-full" onClick={handleContainerClick}>
          <div
            ref={activeRow.containerRef}
            className={cn(
              "w-full rounded-md border border-border px-2 pb-2 pt-0 md:overflow-y-auto",
              maxHeightClassName ?? "md:max-h-64",
            )}
          >
            <ArrayInput source={detailsSource} label={false}>
              <DetailIterator
                addButton={
                  <DetailFooterButtons
                    defaultValues={getDefaultValues()}
                    onAdd={activeRow.requestAutoActivate}
                  />
                }
              >
                <DetailItemRow
                  MainFields={MainFields}
                  OptionalFields={OptionalFields}
                  columns={mainColumns}
                />
              </DetailIterator>
            </ArrayInput>
          </div>
        </div>
      </DetailSectionContext.Provider>
      <Confirm
        isOpen={confirmOpen}
        title="Limpiar detalle"
        content="Se eliminaran todos los items. Deseas continuar?"
        onConfirm={handleClear}
        onClose={() => setConfirmOpen(false)}
      />
    </SectionCard>
  );
};
