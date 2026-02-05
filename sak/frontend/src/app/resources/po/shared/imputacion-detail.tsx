/**
 * Bloque reutilizable de imputacion (detalle).
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CompactComboboxQuery,
  CompactFormField,
} from "@/components/forms";
import type { ComboboxQueryProps } from "@/components/forms/combobox-query";
import { useMutuallyExclusiveHandlers } from "./po-hooks";

type ImputacionDefaults = {
  centro_costo_id?: number | null;
  oportunidad_id?: number | null;
};

type ReferenceLabelGetter = (
  fieldName: string,
  value: number | string | null | undefined
) => string | undefined;

export const ImputacionDetailSection = ({
  form,
  centroCostoReference,
  oportunidadReference,
  imputacionDefaults,
  getReferenceLabel,
  applyDefaults = true,
  resetKey,
  clearValue = "",
  centroCostoField = "centro_costo_id",
  oportunidadField = "oportunidad_id",
  label = "Imputacion",
}: {
  form: UseFormReturn<any>;
  centroCostoReference: ComboboxQueryProps;
  oportunidadReference: ComboboxQueryProps;
  imputacionDefaults?: ImputacionDefaults;
  getReferenceLabel?: ReferenceLabelGetter;
  applyDefaults?: boolean;
  resetKey?: string | number;
  clearValue?: string;
  centroCostoField?: string;
  oportunidadField?: string;
  label?: string;
}) => {
  const [showImputacionFields, setShowImputacionFields] = useState(false);
  const hasInitializedImputacion = useRef(false);

  const centroCostoValue = useWatch({
    control: form.control,
    name: centroCostoField,
  });
  const oportunidadValue = useWatch({
    control: form.control,
    name: oportunidadField,
  });

  const { handleChangeA: handleCentroChange, handleChangeB: handleOportunidadChange } =
    useMutuallyExclusiveHandlers({
      setValue: form.setValue,
      fieldA: centroCostoField,
      fieldB: oportunidadField,
      clearValue,
    });

  useEffect(() => {
    hasInitializedImputacion.current = false;
  }, [resetKey]);

  const imputacionLabel = useMemo(() => {
    if (oportunidadValue) {
      const labelValue =
        getReferenceLabel?.(oportunidadField, oportunidadValue) ??
        `#${oportunidadValue}`;
      return `Oportunidad: ${labelValue}`;
    }
    if (centroCostoValue) {
      const labelValue =
        getReferenceLabel?.(centroCostoField, centroCostoValue) ??
        `#${centroCostoValue}`;
      return `Centro costo: ${labelValue}`;
    }
    return "";
  }, [
    centroCostoField,
    centroCostoValue,
    getReferenceLabel,
    oportunidadField,
    oportunidadValue,
  ]);

  useEffect(() => {
    if (!applyDefaults || hasInitializedImputacion.current) return;

    const centroDefault = imputacionDefaults?.centro_costo_id ?? null;
    const oportunidadDefault = imputacionDefaults?.oportunidad_id ?? null;
    const currentCentro = form.getValues(centroCostoField);
    const currentOportunidad = form.getValues(oportunidadField);

    if (currentCentro || currentOportunidad) {
      hasInitializedImputacion.current = true;
      return;
    }

    if (!centroDefault && !oportunidadDefault) {
      return;
    }

    if (centroDefault) {
      form.setValue(centroCostoField, String(centroDefault), {
        shouldDirty: true,
      });
    } else if (oportunidadDefault) {
      form.setValue(oportunidadField, String(oportunidadDefault), {
        shouldDirty: true,
      });
    }

    hasInitializedImputacion.current = true;
  }, [
    applyDefaults,
    centroCostoField,
    oportunidadField,
    form,
    imputacionDefaults,
  ]);

  return (
    <>
      <div className="mt-2">
        <CompactFormField label={label}>
          <div className="relative">
            <Input
              type="text"
              value={imputacionLabel || "-"}
              readOnly
              tabIndex={-1}
              className="h-7 w-full bg-muted/50 pr-9 text-[11px] sm:h-8 sm:text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowImputacionFields((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md border-border bg-background p-0 text-muted-foreground shadow-none transition hover:text-foreground"
              aria-label={
                showImputacionFields
                  ? "Ocultar imputacion"
                  : "Editar imputacion"
              }
            >
              <PencilLine className="h-3 w-3" />
            </Button>
          </div>
        </CompactFormField>
      </div>
      {showImputacionFields ? (
        <div className="rounded-md border border-border/70 bg-muted/10 p-2 sm:p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CompactFormField label="Centro de costo">
              <CompactComboboxQuery
                {...centroCostoReference}
                value={String(centroCostoValue ?? "")}
                onChange={handleCentroChange}
                placeholder="Selecciona centro"
                clearable
              />
            </CompactFormField>
            <CompactFormField label="Oportunidad">
              <CompactComboboxQuery
                {...oportunidadReference}
                value={String(oportunidadValue ?? "")}
                onChange={handleOportunidadChange}
                placeholder="Selecciona oportunidad"
                clearable
              />
            </CompactFormField>
          </div>
        </div>
      ) : null}
    </>
  );
};
