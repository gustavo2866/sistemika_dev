"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
type SoloActivasToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

// Toggle para filtrar solo oportunidades activas
export const SoloActivasToggle = ({ checked, onCheckedChange }: SoloActivasToggleProps) => (
  <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 shrink-0">
    <Switch id="solo-activas-kanban" checked={checked} onCheckedChange={onCheckedChange} />
    <Label htmlFor="solo-activas-kanban" className="text-sm font-medium">
      Solo activas
    </Label>
  </div>
);

// Toggle para filtrar por tipo de operación (Venta/Alquiler)
// Interfaz para custom filters container
export interface OportunidadCustomFiltersProps {
  // Placeholder para evitar empty interface
  className?: string;
  soloActivas: boolean;
  onSoloActivasChange: (next: boolean) => void;
}

export const OportunidadCustomFilters = ({
  soloActivas,
  onSoloActivasChange,
}: OportunidadCustomFiltersProps) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <SoloActivasToggle checked={soloActivas} onCheckedChange={onSoloActivasChange} />
    </div>
  );
};
