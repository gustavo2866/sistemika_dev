"use client";

import type { ReactNode } from "react";
import { useRecordContext } from "ra-core";

import { FormOrderCancelButton, FormOrderEditButton } from "@/components/forms/form_order";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getTipoContactoBadgeClass,
  getTipoContactoEstadoLabel,
  type CRMTipoContacto,
} from "./model";

//#region Helpers de presentacion

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

const EstadoTipoContactoBadge = ({ activo }: { activo?: boolean | null }) => (
  <Badge variant="secondary" className={getTipoContactoBadgeClass(activo)}>
    {getTipoContactoEstadoLabel(activo)}
  </Badge>
);

//#endregion Helpers de presentacion

//#region Componentes de la vista

const CRMTipoContactoShowTitle = () => {
  const record = useRecordContext<CRMTipoContacto>();
  if (!record) return "Tipo de contacto CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Tipo de contacto CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <EstadoTipoContactoBadge activo={record.activo} />
    </div>
  );
};

const CRMTipoContactoShowContent = () => {
  const record = useRecordContext<CRMTipoContacto>();
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
              <EstadoTipoContactoBadge activo={record.activo} />
            </span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Nombre">
            <TextField source="nombre" />
          </DatoSoloLectura>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <FormOrderCancelButton />
      </div>
    </div>
  );
};

export const CRMTipoContactoShow = () => (
  <Show
    className="w-full max-w-2xl"
    title={<CRMTipoContactoShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <div className="w-full max-w-2xl">
      <CRMTipoContactoShowContent />
    </div>
  </Show>
);

//#endregion Componentes de la vista
