"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Info, MoreHorizontal } from "lucide-react";

import { SectionCard } from "./section_card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SectionBaseTemplateProps = {
  /** Title shown in the section header. */
  title: string;
  /** Main (always visible) content for the section. */
  main: ReactNode;
  /** Optional content toggled by "more/less" action. */
  optional?: ReactNode;
  /** Optional summary content rendered in the header row. */
  headerSummary?: ReactNode;
  /** Extra classNames for the header summary container. */
  headerSummaryClassName?: string;
  /** Whether the section is open on initial render. */
  defaultOpen?: boolean;
  /** Whether the optional content is visible on initial render. */
  defaultOptionalOpen?: boolean;
  /** Optional custom menu items shown in the header actions menu. */
  actions?: ReactNode;
};

export const SectionBaseTemplate = ({
  title,
  main,
  optional,
  headerSummary,
  headerSummaryClassName,
  defaultOpen = true,
  defaultOptionalOpen = false,
  actions,
}: SectionBaseTemplateProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showOptional, setShowOptional] = useState(defaultOptionalOpen);

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

  const actionsMenu = actions ? (
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
        {actions}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const headerActions =
    actionsMenu || headerSummary ? (
      <div className="flex items-center gap-2">
        {headerSummary ? (
          <div className={headerSummaryClassName}>{headerSummary}</div>
        ) : null}
        {actionsMenu}
        {toggleButton}
      </div>
    ) : undefined;

  return (
    <SectionCard
      title={title}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      headerActions={headerActions}
      cardClassName="pt-3 pb-2"
      contentClassName="px-3 pt-0 pb-2"
      titleClassName="mb-2"
    >
      <div className="flex flex-col gap-0">
        {optional ? (
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,max-content)_auto] items-end gap-2">
            <div className="min-w-0">{main}</div>
            <div className="flex items-end justify-end md:justify-self-start">
              <button
                type="button"
                className={cn(
                  "inline-flex h-6 w-6 -mb-1 items-center justify-center rounded-full leading-none transition",
                  showOptional
                    ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50/60",
                )}
                tabIndex={-1}
                onClick={() => setShowOptional((v) => !v)}
                aria-label={showOptional ? "Ocultar datos" : "Mostrar datos"}
                title={showOptional ? "Ocultar datos" : "Mostrar datos"}
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          main
        )}
      </div>
      {optional && showOptional ? optional : null}
    </SectionCard>
  );
};
