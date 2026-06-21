"use client";

import { useSimpleFormIterator } from "ra-core";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDetailSectionContext } from "./detail_section_context";

export const DetailFooterButtons = ({
  defaultValues = {},
  desktopClassName,
  label = "Agregar articulo",
  mobileClassName,
  onAdd,
}: {
  defaultValues?: Record<string, unknown>;
  desktopClassName?: string;
  label?: string;
  mobileClassName?: string;
  onAdd?: () => void;
}) => {
  const { add } = useSimpleFormIterator();
  const detailContext = useDetailSectionContext();
  const disableAdd = detailContext?.activeIndex != null;

  const handleAdd = () => {
    if (disableAdd) return;
    detailContext?.requestAutoActivate?.();
    add(defaultValues);
    onAdd?.();
  };

  const handleTabWithinForm = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const form =
      detailContext?.getFormElement?.() ??
      event.currentTarget.closest("form") ??
      document.querySelector("[data-form-scope='main']");
    if (!form) return;
    const selector =
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const focusables = Array.from(
      form.querySelectorAll<HTMLElement>(selector),
    ).filter(
      (el) =>
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-disabled") !== "true" &&
        el.tabIndex !== -1 &&
        (el.offsetParent !== null || el.getClientRects().length > 0),
    );
    const current = event.currentTarget as HTMLElement;
    const index = focusables.indexOf(current);
    const next = index >= 0 ? focusables[index + 1] ?? focusables[0] : focusables[0];
    if (!next) return;
    event.preventDefault();
    requestAnimationFrame(() => {
      next.focus();
    });
  };

  return (
    <>
      <div className="mt-1 hidden sm:flex w-full items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-6 w-full gap-1 border-blue-300 bg-white text-[10px] font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-700",
            desktopClassName,
          )}
          onClick={(event) => {
            event.stopPropagation();
            handleAdd();
          }}
          onKeyDown={handleTabWithinForm}
          disabled={disableAdd}
        >
          <PlusCircle className="h-4 w-4" />
          {label}
        </Button>
        <div className="hidden sm:block ml-auto w-[28px]" />
        <div className="hidden sm:block w-[28px]" />
      </div>
      <div className={cn("sm:hidden fixed bottom-2 left-[42%] -translate-x-1/2 z-30", mobileClassName)}>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-lg"
          onClick={(event) => {
            event.stopPropagation();
            handleAdd();
          }}
          onKeyDown={handleTabWithinForm}
          disabled={disableAdd}
          aria-label="Agregar linea"
          title="Agregar linea"
        >
          <PlusCircle className="h-3 w-3" />
        </Button>
      </div>
    </>
  );
};
