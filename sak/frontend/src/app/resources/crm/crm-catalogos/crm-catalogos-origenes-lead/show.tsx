"use client";

import type { ReactNode } from "react";
import { useRecordContext } from "ra-core";

import { FormOrderCancelButton, FormOrderEditButton } from "@/components/forms/form_order";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getOrigenLeadBadgeClass,
  getOrigenLeadEstadoLabel,
  type CRMOrigenLead,
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
const EstadoOrigenLeadBadge = ({
  activo,
}: {
  activo?: boolean | null;
}) => (
  <Badge
    variant="secondary"
    className={getOrigenLeadBadgeClass(activo)}
  >
    {getOrigenLeadEstadoLabel(activo)}
  </Badge>
);

//#endregion Helpers de presentacion

//#region Componentes de la vista

// Renderiza el titulo contextual de la vista de detalle.
const CRMOrigenLeadShowTitle = () => {
  const record = useRecordContext<CRMOrigenLead>();
  if (!record) return "Origen de lead CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Origen de lead CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <EstadoOrigenLeadBadge activo={record.activo} />
    </div>
  );
};

// Renderiza el contenido de solo lectura del registro seleccionado.
const CRMOrigenLeadShowContent = () => {
  const record = useRecordContext<CRMOrigenLead>();
  if (!record) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DatoSoloLectura label="ID">
            <TextField source="id" />
          </DatoSoloLectura>
          <DatoSoloLectura label="Estado">
            <span className="inline-flex">
              <EstadoOrigenLeadBadge activo={record.activo} />
            </span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Codigo">
            <TextField source="codigo" />
          </DatoSoloLectura>
          <DatoSoloLectura label="Nombre">
            <TextField source="nombre" />
          </DatoSoloLectura>
        </div>
      </Card>

      <Card className="p-4">
        <DatoSoloLectura label="Descripcion">
          <TextField source="descripcion" />
        </DatoSoloLectura>
      </Card>

      <div className="flex justify-end gap-2">
        <FormOrderCancelButton />
      </div>
    </div>
  );
};

// Renderiza la pagina de detalle del recurso.
export const CRMOrigenLeadShow = () => (
  <Show
    className="w-full max-w-2xl"
    title={<CRMOrigenLeadShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <div className="w-full max-w-2xl">
      <CRMOrigenLeadShowContent />
    </div>
  </Show>
);

//#endregion Componentes de la vista
