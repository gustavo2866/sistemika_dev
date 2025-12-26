"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDataProvider, useRecordContext } from "ra-core";
import type { CRMOportunidad } from "./model";
import type { CRMEvento } from "../crm-eventos/model";
import { CRM_OPORTUNIDAD_ESTADO_BADGES, formatEstadoOportunidad } from "./model";

export const CRMOportunidadShow = () => (
  <Show>
    <CRMOportunidadDetails />
  </Show>
);

const CRMOportunidadDetails = () => {
  const record = useRecordContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const [eventos, setEventos] = useState<CRMEvento[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);

  useEffect(() => {
    if (!record?.id) {
      setEventos([]);
      return;
    }
    let cancel = false;
    const fetchEventos = async () => {
      setLoadingEventos(true);
      try {
        const response = await dataProvider.getList<CRMEvento>("crm/eventos", {
          filter: { oportunidad_id: record.id },
          pagination: { page: 1, perPage: 50 },
          sort: { field: "fecha_evento", order: "DESC" },
        });
        if (!cancel) {
          setEventos(response.data ?? []);
        }
      } catch {
        if (!cancel) {
          setEventos([]);
        }
      } finally {
        if (!cancel) {
          setLoadingEventos(false);
        }
      }
    };
    fetchEventos();
    return () => {
      cancel = true;
    };
  }, [dataProvider, record?.id]);

  if (!record) {
    return null;
  }

  const estadoClass =
    CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ?? "bg-slate-200 text-slate-800";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Oportunidad #{record.id}</h1>
          <p className="text-muted-foreground">
            {record.descripcion_estado || "Sin descripción"}
          </p>
        </div>
        <Badge className={estadoClass}>{formatEstadoOportunidad(record.estado)}</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Relaciones principales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Contacto">
              <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
                <TextField source="nombre_completo" />
              </ReferenceField>
            </Field>
            <Field label="Responsable">
              <ReferenceField source="responsable_id" reference="users" link={false}>
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Tipo de operación">
              <ReferenceField source="tipo_operacion_id" reference="crm/catalogos/tipos-operacion" link={false}>
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Estado">
              <span>{formatEstadoOportunidad(record.estado)}</span>
            </Field>
            <Field label="Fecha estado">
              {record.fecha_estado ? new Date(record.fecha_estado).toLocaleString("es-AR") : "Sin registrar"}
            </Field>
            <Field label="Motivo pérdida">
              <ReferenceField source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" link={false} empty="N/A">
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cotización</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Propiedad">
              <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Emprendimiento">
              <ReferenceField source="emprendimiento_id" reference="emprendimientos" link={false} empty="Sin asignar">
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Monto">
              {record.monto != null ? (
                <NumberField
                  source="monto"
                  record={record}
                  options={{ style: "currency", currency: "USD", maximumFractionDigits: 2 }}
                />
              ) : (
                "Sin datos"
              )}
            </Field>
            <Field label="Moneda">
              <ReferenceField source="moneda_id" reference="monedas" link={false} empty="Sin asignar">
                <TextField source="codigo" />
              </ReferenceField>
            </Field>
            <Field label="Condición de pago">
              <ReferenceField source="condicion_pago_id" reference="crm/catalogos/condiciones-pago" link={false} empty="Sin asignar">
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Probabilidad">
              {record.probabilidad != null ? `${record.probabilidad}%` : "Sin datos"}
            </Field>
            <Field label="Cierre estimado">
              {record.fecha_cierre_estimada
                ? new Date(record.fecha_cierre_estimada).toLocaleDateString("es-AR")
                : "Sin registrar"}
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEventos ? (
            <p className="text-sm text-muted-foreground">Cargando eventos...</p>
          ) : eventos.length ? (
            <div className="max-h-64 overflow-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((evento) => (
                    <TableRow key={evento.id}>
                      <TableCell>
                        {evento.fecha_evento ? new Date(evento.fecha_evento).toLocaleString("es-AR") : "-"}
                      </TableCell>
                      <TableCell>{evento.tipo_catalogo?.nombre ?? evento.tipo_evento ?? evento.titulo ?? `#${evento.tipo_id}`}</TableCell>
                      <TableCell>{evento.motivo_id ? `#${evento.motivo_id}` : "-"}</TableCell>
                      <TableCell>{evento.descripcion}</TableCell>
                      <TableCell>{evento.estado_evento}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin eventos asociados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="text-sm font-medium text-foreground">{children}</div>
  </div>
);
