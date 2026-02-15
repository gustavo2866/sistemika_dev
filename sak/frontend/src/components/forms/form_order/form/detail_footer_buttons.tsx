"use client";

import { useSimpleFormIterator } from "ra-core";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDetailSectionContext } from "./detail_section_context";

export const DetailFooterButtons = ({
  defaultValues = {},
  desktopClassName,
  mobileClassName,
  onAdd,
}: {
  defaultValues?: Record<string, unknown>;
  desktopClassName?: string;
  mobileClassName?: string;
  onAdd?: () => void;
}) => {
  const { add } = useSimpleFormIterator();
  const detailContext = useDetailSectionContext();
  const disableAdd = detailContext?.activeIndex != null;

  const handleAdd = () => {
    if (disableAdd) return;
    add(defaultValues);
    onAdd?.();
  };

  return (
    <>
      <div className="mt-1 hidden sm:flex w-full items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("gap-1 text-[10px] w-full sm:w-[220px] h-6", desktopClassName)}
          onClick={(event) => {
            event.stopPropagation();
            handleAdd();
          }}
          disabled={disableAdd}
        >
          <PlusCircle className="h-4 w-4" />
          Agregar
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
