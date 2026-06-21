"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  focusFirstRowSignal?: number;
  activateOnFocusFirstRow?: boolean;
  maxHeightClassName?: string;
  onActiveRowChange?: (activeIndex: number | null) => void;
  readOnly?: boolean;
  showInfoWhenInactive?: boolean;
  showInfoAction?: boolean;
  showDeleteWhenInactive?: boolean;
  saveOnlyWhenActive?: boolean;
  showExpandActionOnMobile?: boolean;
  showExpandAction?: boolean;
  variant?: "compact" | "table";
  addButtonLabel?: string;
  detailIteratorClassName?: string;
  canDeleteRow?: (rowValue: Record<string, unknown>, index: number) => boolean;
};

type DetailItemRowProps = {
  MainFields: ComponentType<SectionDetailFieldsProps>;
  OptionalFields?: ComponentType<SectionDetailFieldsProps>;
  detailsSource: string;
  columns: SectionDetailColumn[];
  showInfoWhenInactive?: boolean;
  showInfoAction?: boolean;
  showDeleteWhenInactive?: boolean;
  saveOnlyWhenActive?: boolean;
  showExpandActionOnMobile?: boolean;
  showExpandAction?: boolean;
  variant?: "compact" | "table";
  canDeleteRow?: (rowValue: Record<string, unknown>, index: number) => boolean;
};

const DetailItemRow = ({
  MainFields,
  OptionalFields,
  detailsSource,
  columns,
  showInfoWhenInactive,
  showInfoAction = true,
  showDeleteWhenInactive = false,
  saveOnlyWhenActive = false,
  showExpandActionOnMobile = false,
  showExpandAction = false,
  variant = "compact",
  canDeleteRow,
}: DetailItemRowProps) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("DetailItemRow must be used within SectionDetailTemplate2");
  }
  const { rowGridClassName, rowGridStyle, activeIndex, onRowClick, setActiveIndex } =
    detailContext;
  const { getValues } = useFormContext();
  const [showOptional, setShowOptional] = useState(false);
  const { remove, index } = useSimpleFormIteratorItem();
  const isActive = !detailContext.readOnly && activeIndex === index;
  const hasOptional = Boolean(OptionalFields);
  const isTableVariant = variant === "table";
  const rowValue = getValues(`${detailsSource}.${index}`) as Record<string, unknown> | undefined;
  const canDelete = canDeleteRow ? canDeleteRow(rowValue ?? {}, index) : true;

  const handleCollapse = useCallback(() => {
    setShowOptional(false);
    setActiveIndex(null);
  }, [setActiveIndex]);
  const handleCancelEdit = useCallback(() => {
    const rowValue = getValues(`${detailsSource}.${index}`) as { id?: unknown } | undefined;
    const isNewRow = rowValue?.id == null || rowValue.id === "";
    setShowOptional(false);
    setActiveIndex(null);
    if (isNewRow) {
      remove();
    }
  }, [detailsSource, getValues, index, remove, setActiveIndex]);
  const toggleOptional = () => setShowOptional((prev) => !prev);

  useEffect(() => {
    if (detailContext.readOnly) return;
    if (showInfoWhenInactive) return;
    if (!isActive && showOptional) {
      setShowOptional(false);
    }
  }, [isActive, showOptional, detailContext.readOnly, showInfoWhenInactive]);

  useEffect(() => {
    if (!isActive) return;
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      handleCancelEdit();
    };

    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown, true);
    };
  }, [handleCancelEdit, isActive]);

  const rowClassName = cn(
    isTableVariant
      ? cn(
          "rounded-none border-0 px-4 py-3 sm:min-h-[52px] sm:justify-center hover:bg-slate-50",
          "[&>[data-detail-edit-hint]]:hidden",
          isActive && "is-active bg-blue-50/50",
        )
      : isActive
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
      <ResponsiveDetailRow
        className={rowClassName}
        onClick={onRowClick(index)}
        onKeyDownCapture={(event) => {
          if (!isActive || event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          handleCancelEdit();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 sm:block">
          <div
            className={cn(
              "grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1 sm:items-center sm:gap-2",
              isTableVariant && "sm:gap-3",
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
              showInfo={showInfoAction && hasOptional}
              showInfoWhenInactive={showInfoWhenInactive}
              showDeleteWhenInactive={showDeleteWhenInactive}
              saveOnlyWhenActive={saveOnlyWhenActive}
              showExpandActionOnMobile={showExpandActionOnMobile}
              showExpandAction={showExpandAction}
              variant={variant}
              canDelete={canDelete}
            />
            <DetailRowError />
          </div>
          <div className="flex items-end justify-end self-end sm:hidden">
            <DetailRowActions
              mode="mobile"
              readOnly={detailContext.readOnly}
              forceVisible={detailContext.readOnly}
              showInfo={showInfoAction && hasOptional}
              showInfoWhenInactive={showInfoWhenInactive}
              showDeleteWhenInactive={showDeleteWhenInactive}
              saveOnlyWhenActive={saveOnlyWhenActive}
              showExpandActionOnMobile={showExpandActionOnMobile}
              showExpandAction={showExpandAction}
              variant={variant}
              canDelete={canDelete}
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
  focusFirstRowSignal,
  activateOnFocusFirstRow = true,
  maxHeightClassName,
  onActiveRowChange,
  readOnly = false,
  showInfoWhenInactive = false,
  showInfoAction = true,
  showDeleteWhenInactive = false,
  saveOnlyWhenActive = false,
  showExpandActionOnMobile = false,
  showExpandAction = false,
  variant = "compact",
  addButtonLabel = "Agregar",
  detailIteratorClassName,
  canDeleteRow,
}: SectionDetailTemplate2Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { getValues, setValue } = useFormContext();
  const resolvedFocusSelector = focusSelector ?? '[data-focus-field="true"]';
  const activeRow = useActiveRow({ name: detailsSource, focusSelector });
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const previousFocusFirstRowSignalRef = useRef(focusFirstRowSignal);
  const disableAdd = readOnly || activeRow.activeIndex != null;
  const detalles = useWatch({ name: detailsSource }) as unknown[] | undefined;
  const hasDetails = (detalles ?? []).length > 0;
  const getFormElement = useCallback(() => {
    const form =
      sectionRef.current?.closest("form") ??
      document.querySelector("[data-form-scope='main']");
    return (form as HTMLFormElement | null) ?? null;
  }, []);
  const tabbingOutRef = useRef(false);

  const getFocusableElements = useCallback((form: HTMLElement) => {
    const selector =
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    return Array.from(form.querySelectorAll<HTMLElement>(selector)).filter(
      (el) =>
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-disabled") !== "true" &&
        el.tabIndex !== -1 &&
        (el.offsetParent !== null || el.getClientRects().length > 0),
    );
  }, []);

  const focusNextWithinForm = useCallback(() => {
    const form = getFormElement();
    if (!form) return;
    const focusables = getFocusableElements(form);
    if (!focusables.length) return;
    let next: HTMLElement | undefined;
    if (sectionRef.current) {
      next = focusables.find((el) => sectionRef.current?.contains(el));
      if (!next) {
        next = focusables.find((el) => {
          if (sectionRef.current?.contains(el)) return false;
          const position = sectionRef.current?.compareDocumentPosition(el) ?? 0;
          return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        });
      }
    }
    next = next ?? focusables[0];
    requestAnimationFrame(() => {
      next?.focus();
    });
  }, [getFormElement, getFocusableElements]);

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

  const isTableVariant = variant === "table";

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
    [readOnly, activeRow],
  );

  useEffect(() => {
    onActiveRowChange?.(activeRow.activeIndex ?? null);
    return () => {
      onActiveRowChange?.(null);
    };
  }, [activeRow.activeIndex, onActiveRowChange]);

  useEffect(() => {
    if (focusFirstRowSignal == null) return;
    if (previousFocusFirstRowSignalRef.current === focusFirstRowSignal) return;
    previousFocusFirstRowSignalRef.current = focusFirstRowSignal;

    const current = (getValues(detailsSource) as unknown[]) ?? [];
    if (!current.length || readOnly) return;

    if (activateOnFocusFirstRow) {
      activeRow.setActiveIndex(0);
    }
    const container = activeRow.containerRef.current;
    window.setTimeout(() => {
      const first = container?.querySelector(resolvedFocusSelector);
      const focusTarget =
        (first?.querySelector('[role="combobox"]') as HTMLElement | null) ??
        (first?.querySelector("input, textarea, button") as HTMLElement | null) ??
        (first as HTMLElement | null);
      focusTarget?.focus();
    }, 0);
  }, [
    activeRow,
    activateOnFocusFirstRow,
    detailsSource,
    focusFirstRowSignal,
    getValues,
    readOnly,
    resolvedFocusSelector,
  ]);

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
      <DropdownMenuContent
        align="end"
        className="w-32"
        onKeyDown={(event) => {
          if (event.key !== "Tab" || event.shiftKey) return;
          tabbingOutRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (!tabbingOutRef.current) return;
          tabbingOutRef.current = false;
          event.preventDefault();
          focusNextWithinForm();
        }}
        onInteractOutside={() => {
          tabbingOutRef.current = false;
        }}
      >
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

  const directAddButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      tabIndex={-1}
      className="h-8 gap-2 rounded-md border-blue-300 bg-white px-3 text-[11px] font-medium text-blue-700 shadow-sm hover:bg-blue-50 hover:text-blue-700"
      onClick={(event) => {
        event.stopPropagation();
        handleAdd();
      }}
      disabled={disableAdd}
    >
      <PlusCircle className="h-3.5 w-3.5" />
      {addButtonLabel}
    </Button>
  );

  const headerActions = isTableVariant ? (
    <div className="flex items-center gap-2">
      {!readOnly ? directAddButton : null}
      {actionsMenu}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {actionsMenu}
      {toggleButton}
    </div>
  );

  return (
    <div ref={sectionRef}>
      <SectionCard
      title={title}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      headerTabIndex={-1}
      headerActions={headerActions}
      cardClassName={
        isTableVariant
          ? "overflow-hidden rounded-lg border-slate-200 bg-white pt-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
          : "pt-3"
      }
      contentClassName={isTableVariant ? "px-0 pt-0 pb-0" : "px-2 pt-0 pb-1"}
      headerClassName={isTableVariant ? "px-4 pb-3" : undefined}
      titleClassName={isTableVariant ? "mb-0 text-base font-bold" : "mb-0"}
    >
      {mainColumns?.length ? (
        <div
          className={cn(
            isTableVariant
              ? "hidden border-y border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold text-slate-700 sm:grid sm:gap-3"
              : "hidden sm:grid sm:gap-2 mt-2 text-[10px] font-semibold text-foreground pb-0 px-2",
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
          getFormElement,
        }}
      >
        <div
          className={cn(isTableVariant ? "mt-0" : "mt-1", "space-y-0 w-full")}
          onClick={handleContainerClick}
        >
          <div
            ref={activeRow.containerRef}
            className={cn(
              isTableVariant
                ? "w-full overflow-x-hidden px-0 pb-0 pt-0 md:overflow-y-auto"
                : "w-full rounded-md border border-border px-2 pb-2 pt-0 md:overflow-y-auto",
              maxHeightClassName ?? "md:max-h-64",
            )}
          >
            <ArrayInput source={detailsSource} label={false}>
              <DetailIterator
                className={
                  cn(
                    isTableVariant
                      ? "[&_ul]:gap-0 [&_li]:!border-b [&_li]:!border-slate-200 [&_li:last-child]:!border-b-0"
                      : undefined,
                    detailIteratorClassName,
                  )
                }
                addButton={
                  isTableVariant ? (
                    <div />
                  ) : (
                    <DetailFooterButtons
                      defaultValues={getDefaultValues()}
                      label={addButtonLabel}
                      onAdd={activeRow.requestAutoActivate}
                    />
                  )
                }
              >
                <DetailItemRow
                  MainFields={MainFields}
                  OptionalFields={OptionalFields}
                  detailsSource={detailsSource}
                  columns={mainColumns}
                  showInfoWhenInactive={showInfoWhenInactive}
                  showInfoAction={showInfoAction}
                  showDeleteWhenInactive={showDeleteWhenInactive}
                  saveOnlyWhenActive={saveOnlyWhenActive}
                  showExpandActionOnMobile={showExpandActionOnMobile}
                  showExpandAction={showExpandAction}
                  variant={variant}
                  canDeleteRow={canDeleteRow}
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
    </div>
  );
};
