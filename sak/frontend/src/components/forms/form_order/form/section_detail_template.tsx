"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, PlusCircle, Trash } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { SectionCard } from "./section_card";
import { useActiveRow } from "./use_active_row";
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

export type SectionDetailTemplateProps = {
  /** Title shown in the section header. */
  title: string;
  /** Main list/content for the detail section. */
  list: ReactNode;
  /** Optional columns rendered as a header row (desktop only). */
  columns?: { label: string; className?: string }[];
  /** Extra classNames for the columns row container. */
  columnsClassName?: string;
  /** Optional content rendered in the header actions row (right side). */
  headerSummary?: ReactNode;
  /** Extra classNames for the header summary container. */
  headerSummaryClassName?: string;
  /** Whether the section is open on initial render. */
  defaultOpen?: boolean;
  /** Optional extra menu items appended after the default detail actions. */
  actions?: ReactNode;
  /** Form field name for the details array. */
  detailsSource?: string;
  /** Selector used to focus the primary field when a new row is added. */
  focusSelector?: string;
  /** Default values for a new detail row. */
  defaultDetailValues?: Record<string, unknown>;
};

type DetailSectionContextValue = ReturnType<typeof useActiveRow> & {
  rowGridClassName?: string;
  rowGridStyle?: CSSProperties;
};

const DetailSectionContext = createContext<DetailSectionContextValue | null>(
  null,
);

export const useDetailSectionContext = () =>
  useContext(DetailSectionContext);

export const SectionDetailTemplate = ({
  title,
  list,
  columns,
  columnsClassName,
  headerSummary,
  headerSummaryClassName,
  defaultOpen = true,
  actions,
  detailsSource = "detalles",
  focusSelector,
  defaultDetailValues,
}: SectionDetailTemplateProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { getValues, setValue } = useFormContext();
  const activeRow = useActiveRow({ name: detailsSource, focusSelector });
  const detalles = useWatch({ name: detailsSource }) as unknown[] | undefined;
  const hasDetails = (detalles ?? []).length > 0;
  const gridTemplate = useMemo(() => {
    if (!columnsClassName) return undefined;
    const match = columnsClassName.match(/grid-cols-\[([^\]]+)\]/);
    return match?.[1]?.replace(/_/g, " ");
  }, [columnsClassName]);
  const columnsClassNameSansGrid = useMemo(() => {
    if (!columnsClassName) return undefined;
    return columnsClassName.replace(/grid-cols-\[[^\]]+\]/g, "").trim();
  }, [columnsClassName]);
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

  const handleAdd = () => {
    const current = (getValues(detailsSource) as unknown[]) ?? [];
    const nextItem = defaultDetailValues ? { ...defaultDetailValues } : {};
    setValue(detailsSource, [...current, nextItem], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleClear = () => {
    setValue(detailsSource, [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const handleContainerClick = () => {
    // Intentionally no-op: exiting edit mode is handled explicitly via row actions
  };

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
          onClick={handleAdd}
        >
          <PlusCircle className="h-3 w-3" />
          Agregar
        </DropdownMenuItem>
        {hasDetails ? (
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
      {headerSummary ? (
        <div className={cn("flex items-center gap-2", headerSummaryClassName)}>
          {headerSummary}
        </div>
      ) : null}
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
      {columns?.length ? (
        <div
          className={cn(
            "hidden sm:grid sm:gap-2 mt-2 text-[10px] font-semibold text-foreground pb-0 px-2",
            rowGridClassName ?? columnsClassNameSansGrid,
          )}
          style={rowGridStyle}
        >
          {columns.map((column, index) => (
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
          rowGridClassName,
          rowGridStyle,
        }}
      >
        {list}
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
