"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PlusCircle, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";
export const DetailHeaderActions = ({
  detailsSource = "detalles",
}: {
  detailsSource?: string;
}) => {
  const { getValues, setValue } = useFormContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detalles = useWatch({ name: detailsSource }) as unknown[] | undefined;
  const hasDetails = (detalles ?? []).length > 0;

  const handleClear = () => {
    setValue(detailsSource, [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const handleAdd = () => {
    const current = (getValues(detailsSource) as unknown[]) ?? [];
    setValue(detailsSource, [...current, {}], { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1 text-[9px] text-primary h-6 px-2"
        onClick={handleAdd}
        tabIndex={-1}
      >
        <PlusCircle className="h-3 w-3" />
        Agregar
      </Button>
      {hasDetails ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-[9px] text-destructive h-6 px-2"
          onClick={() => setConfirmOpen(true)}
          tabIndex={-1}
        >
          <Trash className="h-3 w-3" />
          Limpiar
        </Button>
      ) : null}
      <Confirm
        isOpen={confirmOpen}
        title="Limpiar detalle"
        content="Se eliminaran todos los items. Deseas continuar?"
        onConfirm={handleClear}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
};
