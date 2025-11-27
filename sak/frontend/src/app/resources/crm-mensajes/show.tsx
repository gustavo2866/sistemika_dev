"use client";

import { Show } from "@/components/show";
import { useRecordContext } from "ra-core";
import type { CRMMensaje } from "./model";
import {
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajePrioridad,
  formatMensajeTipo,
  CRM_MENSAJE_ESTADO_BADGES,
  CRM_MENSAJE_PRIORIDAD_BADGES,
} from "./model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const CRMMensajeShow = () => (
  <Show>
    <CRMMensajeDetails />
  </Show>
);

const CRMMensajeDetails = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return null;

  const estadoClass =
    CRM_MENSAJE_ESTADO_BADGES[record.estado] ?? "bg-slate-200 text-slate-800";
  const prioridadClass =
    CRM_MENSAJE_PRIORIDAD_BADGES[record.prioridad] ?? "bg-slate-200 text-slate-800";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            Mensaje #{record.id}
          </p>
          <h1 className="text-2xl font-semibold">{record.asunto || "Sin asunto"}</h1>
          {record.fecha_mensaje ? (
            <p className="text-sm text-muted-foreground">
              {new Date(record.fecha_mensaje).toLocaleString("es-AR")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={estadoClass}>{formatMensajeEstado(record.estado)}</Badge>
          <Badge className={prioridadClass}>{formatMensajePrioridad(record.prioridad)}</Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos principales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Tipo">{formatMensajeTipo(record.tipo)}</Field>
            <Field label="Canal">{formatMensajeCanal(record.canal)}</Field>
            <Field label="Contacto">
              {record.contacto?.nombre_completo
                ? record.contacto.nombre_completo
                : record.contacto_id
                ? `Contacto #${record.contacto_id}`
                : "Sin asignar"}
            </Field>
            <Field label="Referencia">{record.contacto_referencia || "N/A"}</Field>
            <Field label="Nombre propuesto">
              {record.contacto_nombre_propuesto || "N/A"}
            </Field>
            <Field label="ID externo">{record.origen_externo_id || "N/A"}</Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestión CRM</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Responsable">
              {record.responsable?.nombre
                ? record.responsable.nombre
                : record.responsable_id
                ? `Usuario #${record.responsable_id}`
                : "Sin asignar"}
            </Field>
            <Field label="Oportunidad">
              {record.oportunidad?.id
                ? `#${record.oportunidad.id} - ${record.oportunidad.descripcion_estado ?? ""}`
                : record.oportunidad_id
                ? `#${record.oportunidad_id}`
                : "Sin asignar"}
            </Field>
            <Field label="Evento vinculado">
              {record.evento_id ? `Evento #${record.evento_id}` : "Sin evento"}
            </Field>
            <Field label="Generar oportunidad">
              {record.oportunidad_generar ? "Sí" : "No"}
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contenido</CardTitle>
        </CardHeader>
        <CardContent>
          {record.contenido ? (
            <p className="whitespace-pre-line text-sm">{record.contenido}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin contenido registrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="text-sm font-medium text-foreground">{children}</div>
  </div>
);
