"use client";

import type { ReactNode } from "react";
import { useRecordContext } from "ra-core";
import { UserRound } from "lucide-react";

import {
  FormOrderCancelButton,
  FormOrderEditButton,
} from "@/components/forms/form_order";
import { ReferenceField } from "@/components/reference-field";
import { Show } from "@/components/show";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/text-field";

import type { CRMContacto } from "./model";

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

const TextoConFallback = ({
  value,
  fallback = "Sin dato",
}: {
  value?: string | null;
  fallback?: string;
}) => <span>{value?.trim() ? value : fallback}</span>;

const formatTelefonos = (value?: string[] | null) =>
  Array.isArray(value) && value.length > 0 ? value.join(", ") : "Sin dato";

const CRMContactoShowTitle = () => {
  const record = useRecordContext<CRMContacto>();
  if (!record) return "Contacto CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2">
        <UserRound className="h-4 w-4" />
        Contacto CRM
      </span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
    </div>
  );
};

const CRMContactoShowContent = () => {
  const record = useRecordContext<CRMContacto>();
  if (!record) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DatoSoloLectura label="ID">
            <span>{record.id}</span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Nombre completo">
            <TextoConFallback value={record.nombre_completo} />
          </DatoSoloLectura>
          <DatoSoloLectura label="Telefono principal">
            <span>{formatTelefonos(record.telefonos)}</span>
          </DatoSoloLectura>
          <DatoSoloLectura label="Email">
            <TextoConFallback value={record.email} />
          </DatoSoloLectura>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DatoSoloLectura label="Usuario / red social">
            <TextoConFallback value={record.red_social} />
          </DatoSoloLectura>
          <DatoSoloLectura label="Responsable">
            <ReferenceField source="responsable_id" reference="users" link={false}>
              <TextField source="nombre" />
            </ReferenceField>
          </DatoSoloLectura>
          <DatoSoloLectura label="Notas">
            <TextoConFallback value={record.notas} fallback="Sin notas" />
          </DatoSoloLectura>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <FormOrderCancelButton />
      </div>
    </div>
  );
};

export const CRMContactoShow = () => (
  <Show
    className="w-full max-w-2xl"
    title={<CRMContactoShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <div className="w-full max-w-2xl">
      <CRMContactoShowContent />
    </div>
  </Show>
);
