"use client";

import {
  createContext,
  useContext,
  useState,
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
  /** Whether the section is open on initial render. */
  defaultOpen?: boolean;
  /** Optional extra menu items appended after the default detail actions. */
  actions?: ReactNode;
  /** Form field name for the details array. */
  detailsSource?: string;
  /** Selector used to focus the primary field when a new row is added. */
  focusSelector?: string;
};

type DetailSectionContextValue = ReturnType<typeof useActiveRow>;

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
  defaultOpen = true,
  actions,
  detailsSource = "detalles",
  focusSelector,
}: SectionDetailTemplateProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { getValues, setValue } = useFormContext();
  const activeRow = useActiveRow({ name: detailsSource, focusSelector });
  const detalles = useWatch({ name: detailsSource }) as unknown[] | undefined;
  const hasDetails = (detalles ?? []).length > 0;

  const handleAdd = () => {
    const current = (getValues(detailsSource) as unknown[]) ?? [];
    setValue(detailsSource, [...current, {}], { shouldDirty: true, shouldValidate: true });
  };

  const handleClear = () => {
    setValue(detailsSource, [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const toggleButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground"
      onClick={() => setIsOpen((v) => !v)}
      aria-label={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
      title={isOpen ? `Ocultar ${title}` : `Mostrar ${title}`}
    >
      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </Button>
  );

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          tabIndex={-1}
        >
          <MoreHorizontal className="h-4 w-4" />
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

  const headerActions = actions ? (
    <div className="flex items-center gap-1">
      {actionsMenu}
      {toggleButton}
    </div>
  ) : (
    <div className="flex items-center gap-1">
      {actionsMenu}
      {toggleButton}
    </div>
  );

  return (
    <SectionCard
      title={title}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      headerActions={headerActions}
      cardClassName="pt-2"
      contentClassName="px-3 pt-0 pb-2"
      titleClassName="mb-0"
    >
      {columns?.length ? (
        <div
          className={cn(
            "hidden sm:grid gap-2 text-[10px] font-semibold text-foreground [&>div]:pl-2 pb-0",
            columnsClassName,
          )}
        >
          {columns.map((column, index) => (
            <div key={`${column.label}-${index}`} className={column.className}>
              {column.label}
            </div>
          ))}
        </div>
      ) : null}
      <DetailSectionContext.Provider value={activeRow}>
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
