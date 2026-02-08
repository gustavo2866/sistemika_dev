"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PlusCircle, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";
import { DetalleToggleButton } from "./detalle_toggle_button";

export const DetalleHeaderActions = ({
  showDetalle,
  setShowDetalle,
  detallesSource = "detalles",
}: {
  showDetalle: boolean;
  setShowDetalle: React.Dispatch<React.SetStateAction<boolean>>;
  detallesSource?: string;
}) => {
  const { getValues, setValue } = useFormContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const detalles = useWatch({ name: detallesSource }) as unknown[] | undefined;
  const hasDetalles = (detalles ?? []).length > 0;

  const handleClear = () => {
    setValue(detallesSource, [], { shouldDirty: true, shouldValidate: true });
    setConfirmOpen(false);
  };

  const handleAdd = () => {
    const current = (getValues(detallesSource) as unknown[]) ?? [];
    setValue(detallesSource, [...current, {}], { shouldDirty: true, shouldValidate: true });
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
      {hasDetalles ? (
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
      <DetalleToggleButton
        show={showDetalle}
        onToggle={() => setShowDetalle((v) => !v)}
        tabIndex={-1}
      />
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
