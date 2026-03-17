"use client";

import type { ReactNode } from "react";
import { useRecordContext } from "ra-core";

import { FormOrderCancelButton, FormOrderEditButton } from "@/components/forms/form_order";
import { Show } from "@/components/show";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getCelularBadgeClass,
  getCelularEstadoLabel,
  type CRMCelular,
} from "./model";

//#region Helpers de presentacion

// Renderiza una pareja etiqueta-valor para la vista de solo lectura.
const DatoSoloLectura = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[8px] uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="text-[11px] font-medium text-foreground">{children}</div>
  </div>
);

// Renderiza el badge de estado segun el valor activo del registro.
const EstadoCelularBadge = ({
  activo,
}: {
  activo?: boolean | null;
}) => (
  <Badge
    variant="secondary"
    className={getCelularBadgeClass(activo)}
  >
    {getCelularEstadoLabel(activo)}
  </Badge>
);

// Renderiza un valor de texto con fallback legible cuando esta vacio.
const TextoConFallback = ({
  value,
  fallback = "Sin dato",
}: {
  value?: string | null;
  fallback?: string;
}) => <span>{value?.trim() ? value : fallback}</span>;

//#endregion Helpers de presentacion

//#region Componentes de la vista

// Renderiza el titulo contextual de la vista de detalle.
const CRMCelularShowTitle = () => {
  const record = useRecordContext<CRMCelular>();
  if (!record) return "Celular CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Celular CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <EstadoCelularBadge activo={record.activo} />
    </div>
  );
};

// Renderiza el contenido de solo lectura del registro seleccionado.
const CRMCelularShowContent = () => {
  const record = useRecordContext<CRMCelular>();
  if (!record) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DatoSoloLectura label="ID">
            <span>{record.id}</span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Estado">
            <span className="inline-flex">
              <EstadoCelularBadge activo={record.activo} />
            </span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Alias">
            <TextoConFallback value={record.alias} fallback="Sin alias" />
          </DatoSoloLectura>
          <DatoSoloLectura label="Numero celular">
            <TextoConFallback value={record.numero_celular} />
          </DatoSoloLectura>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DatoSoloLectura label="Meta celular ID">
            <TextoConFallback value={record.meta_celular_id} />
          </DatoSoloLectura>
          <DatoSoloLectura label="Ultima actualizacion">
            <TextoConFallback value={record.updated_at} fallback="Sin registro" />
          </DatoSoloLectura>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <FormOrderCancelButton />
      </div>
    </div>
  );
};

// Renderiza la pagina de detalle del recurso.
export const CRMCelularShow = () => (
  <Show
    className="w-full max-w-2xl"
    title={<CRMCelularShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <div className="w-full max-w-2xl">
      <CRMCelularShowContent />
    </div>
  </Show>
);

//#endregion Componentes de la vista

