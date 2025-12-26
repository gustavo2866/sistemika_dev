"use client";

import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useListContext, useGetList } from "ra-core";

// Toggle para filtrar solo oportunidades activas
export const SoloActivasToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const isSoloActivas = Boolean(filterValues.activo);

  const handleToggle = (checked: boolean) => {
    const nextFilters = { ...filterValues };
    if (checked) {
      nextFilters.activo = true;
    } else {
      delete nextFilters.activo;
    }
    setFilters(nextFilters, {});
  };

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 shrink-0">
      <Switch id="solo-activas-kanban" checked={isSoloActivas} onCheckedChange={handleToggle} />
      <Label htmlFor="solo-activas-kanban" className="text-sm font-medium">
        Solo activas
      </Label>
    </div>
  );
};

// Toggle para filtrar por tipo de operación (Venta/Alquiler)
export const OperacionToggle = () => {
  const { filterValues, setFilters } = useListContext();
  const { data: tipos } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const { ventaId, alquilerId } = useMemo(() => {
    const findMatch = (term: string) =>
      tipos?.find(
        (tipo: any) =>
          tipo?.codigo?.toLowerCase().includes(term) || tipo?.nombre?.toLowerCase().includes(term),
      );
    const venta = findMatch("venta");
    const alquiler = findMatch("alquiler");
    return {
      ventaId: venta?.id ? String(venta.id) : undefined,
      alquilerId: alquiler?.id ? String(alquiler.id) : undefined,
    };
  }, [tipos]);

  const currentId = filterValues.tipo_operacion_id ? String(filterValues.tipo_operacion_id) : undefined;
  const currentMode = currentId === ventaId ? "venta" : currentId === alquilerId ? "alquiler" : "todas";

  const handleSelect = (mode: "todas" | "venta" | "alquiler") => {
    const nextFilters = { ...filterValues };
    if (mode === "venta" && ventaId) {
      nextFilters.tipo_operacion_id = ventaId;
    } else if (mode === "alquiler" && alquilerId) {
      nextFilters.tipo_operacion_id = alquilerId;
    } else {
      delete nextFilters.tipo_operacion_id;
    }
    setFilters(nextFilters, {});
  };

  const renderToggle = (
    mode: "venta" | "alquiler",
    label: string,
    disabled?: boolean,
    extraClass?: string,
  ) => {
    const active = currentMode === mode;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelect(active ? "todas" : mode)}
        className={cn(
          "min-w-[70px] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
          active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
          disabled && "opacity-40 cursor-not-allowed",
          extraClass,
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center rounded-full border border-slate-200/80 bg-white/80 shadow-sm overflow-hidden shrink-0">
      {renderToggle("venta", "Venta", !ventaId, "rounded-l-full")}
      {renderToggle("alquiler", "Alquiler", !alquilerId, "rounded-r-full")}
    </div>
  );
};

// Interfaz para custom filters container
export interface OportunidadCustomFiltersProps {
  // Placeholder para evitar empty interface
  className?: string;
}

export const OportunidadCustomFilters = ({}: OportunidadCustomFiltersProps) => {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <OperacionToggle />
      <SoloActivasToggle />
    </div>
  );
};
