"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { useRecordContext } from "ra-core";

export const TipoPropiedadShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nombre" label="Nombre" />
      <TextField source="descripcion" label="Descripcion" />
      <ActivoBadge />
    </SimpleShowLayout>
  </Show>
);

const ActivoBadge = () => {
  const record = useRecordContext<{ activo?: boolean | null }>();
  const isActive = Boolean(record?.activo);
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">Activo</div>
      <Badge className={isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
        {isActive ? "Si" : "No"}
      </Badge>
    </div>
  );
};

