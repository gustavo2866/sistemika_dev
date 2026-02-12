"use client";

import { useEffect, useRef } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

export const useDetalleCentroCostoOportunidadExclusion = () => {
  const { setValue, control } = useFormContext();
  const { dirtyFields } = useFormState({ control });
  const detalles = useWatch({ name: "detalles" }) as
    | Array<Record<string, unknown>>
    | undefined;

  const prevDetalles = useRef<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const current = detalles ?? [];
    const previous = prevDetalles.current ?? [];

    current.forEach((row, index) => {
      const prevRow = previous[index] ?? {};
      const nextCentro = row?.centro_costo_id as number | undefined;
      const nextOportunidad = row?.oportunidad_id as number | undefined;
      const prevCentro = prevRow?.centro_costo_id as number | undefined;
      const prevOportunidad = prevRow?.oportunidad_id as number | undefined;

      if (nextCentro != null && nextCentro !== prevCentro) {
        const centroDirty = (dirtyFields as any)?.detalles?.[index]
          ?.centro_costo_id;
        if (centroDirty) {
          setValue(`detalles.${index}.oportunidad_id`, null, {
            shouldDirty: true,
          });
        }
      }

      if (nextOportunidad != null && nextOportunidad !== prevOportunidad) {
        const oportunidadDirty = (dirtyFields as any)?.detalles?.[index]
          ?.oportunidad_id;
        if (oportunidadDirty) {
          setValue(`detalles.${index}.centro_costo_id`, null, {
            shouldDirty: true,
          });
        }
      }
    });

    prevDetalles.current = current;
  }, [detalles, dirtyFields, setValue]);
};
