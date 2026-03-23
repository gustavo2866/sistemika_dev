"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDataProvider, useRecordContext } from "ra-core";
import {
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Home,
  Target,
  Users,
} from "lucide-react";

import {
  FormOrderDeleteButton,
  FormOrderEditButton,
} from "@/components/forms/form_order";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { ResourceTitle } from "@/components/resource-title";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { CRMEvento } from "../crm-eventos/model";
import type { CRMOportunidad } from "./model";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatDateValue,
  formatDateTimeValue,
  formatEstadoOportunidad,
  formatOportunidadTitulo,
} from "./model";

export const CRMOportunidadShow = () => (
  <Show
    className="w-full max-w-5xl"
    title={<CRMOportunidadShowTitle />}
    actions={<CRMOportunidadShowActions />}
  >
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

    let cancelled = false;

    const fetchEventos = async () => {
      setLoadingEventos(true);
      try {
        const response = await dataProvider.getList<CRMEvento>("crm/crm-eventos", {
          filter: { oportunidad_id: record.id },
          pagination: { page: 1, perPage: 50 },
          sort: { field: "fecha_evento", order: "DESC" },
        });

        if (!cancelled) {
          setEventos(response.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setEventos([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEventos(false);
        }
      }
    };

    fetchEventos();

    return () => {
      cancelled = true;
    };
  }, [dataProvider, record?.id]);

  if (!record) return null;

  const estadoClass =
    CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ??
    "bg-slate-200 text-slate-800";

  return (
    <div className="w-full max-w-5xl space-y-5">
      <Card className="border-border/70 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Oportunidad #{record.id}
                </span>
                <Badge className={estadoClass}>
                  {formatEstadoOportunidad(record.estado)}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {formatOportunidadTitulo(record)}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {record.descripcion_estado || "Sin descripcion comercial registrada."}
                </p>
              </div>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-2 sm:min-w-[280px]">
              <SummaryItem
                icon={Users}
                label="Contacto"
                value={
                  <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
                    <TextField source="nombre_completo" />
                  </ReferenceField>
                }
              />
              <SummaryItem
                icon={Target}
                label="Operacion"
                value={
                  <ReferenceField
                    source="tipo_operacion_id"
                    reference="crm/catalogos/tipos-operacion"
                    link={false}
                  >
                    <TextField source="nombre" />
                  </ReferenceField>
                }
              />
              <SummaryItem
                icon={CircleDollarSign}
                label="Monto"
                value={
                  record.monto != null ? (
                    <NumberField
                      source="monto"
                      record={record}
                      options={{
                        style: "decimal",
                        maximumFractionDigits: 2,
                      }}
                    />
                  ) : (
                    "Sin datos"
                  )
                }
              />
              <SummaryItem
                icon={CalendarClock}
                label="Cierre estimado"
                value={formatDateValue(record.fecha_cierre_estimada)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" />
              Vinculos y gestion
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Tipo de operacion">
              <ReferenceField
                source="tipo_operacion_id"
                reference="crm/catalogos/tipos-operacion"
                link={false}
              >
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Propiedad">
              <ReferenceField source="propiedad_id" reference="propiedades" link={false}>
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Emprendimiento">
              <ReferenceField
                source="emprendimiento_id"
                reference="emprendimientos"
                link={false}
                empty="Sin asignar"
              >
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Creada">
              {formatDateTimeValue(record.created_at)}
            </Field>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-muted-foreground" />
              Estado y negociacion
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado">
              <span>{formatEstadoOportunidad(record.estado)}</span>
            </Field>
            <Field label="Fecha estado">
              {formatDateTimeValue(record.fecha_estado)}
            </Field>
            <Field label="Probabilidad">
              {record.probabilidad != null ? `${record.probabilidad}%` : "Sin datos"}
            </Field>
            <Field label="Moneda">
              <ReferenceField
                source="moneda_id"
                reference="monedas"
                link={false}
                empty="Sin asignar"
              >
                <TextField source="codigo" />
              </ReferenceField>
            </Field>
            <Field label="Condicion de pago">
              <ReferenceField
                source="condicion_pago_id"
                reference="crm/catalogos/condiciones-pago"
                link={false}
                empty="Sin asignar"
              >
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
            <Field label="Forma de pago">
              {record.forma_pago_descripcion || "Sin registrar"}
            </Field>
            <Field label="Motivo perdida" className="sm:col-span-2">
              <ReferenceField
                source="motivo_perdida_id"
                reference="crm/catalogos/motivos-perdida"
                link={false}
                empty="No aplica"
              >
                <TextField source="nombre" />
              </ReferenceField>
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="size-4 text-muted-foreground" />
            Seguimiento y eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEventos ? (
            <p className="text-sm text-muted-foreground">Cargando eventos...</p>
          ) : eventos.length ? (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table className="text-sm">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground">Fecha</TableHead>
                    <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                    <TableHead className="font-semibold text-foreground">Motivo</TableHead>
                    <TableHead className="font-semibold text-foreground">Descripcion</TableHead>
                    <TableHead className="font-semibold text-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventos.map((evento) => (
                    <TableRow key={evento.id}>
                      <TableCell>
                        {evento.fecha_evento
                          ? new Date(evento.fecha_evento).toLocaleString("es-AR")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {evento.tipo_catalogo?.nombre ??
                          evento.tipo_evento ??
                          evento.titulo ??
                          `#${evento.tipo_id}`}
                      </TableCell>
                      <TableCell>
                        {evento.motivo_id ? `#${evento.motivo_id}` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {evento.descripcion || "-"}
                      </TableCell>
                      <TableCell>{evento.estado_evento || "-"}</TableCell>
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

const CRMOportunidadShowTitle = () => {
  const record = useRecordContext<CRMOportunidad>();
  return (
    <ResourceTitle
      icon={Target}
      text={record ? formatOportunidadTitulo(record) : "CRM - Oportunidad"}
    />
  );
};

const CRMOportunidadShowActions = () => (
  <div className="flex items-center gap-2">
    <FormOrderEditButton />
    <FormOrderDeleteButton
      redirect="list"
      mutationOptions={{
        mutationMode: "pessimistic",
      }}
    />
  </div>
);

const SummaryItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
}) => (
  <div className="rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm">
    <div className="flex items-start gap-2">
      <div className="mt-0.5 rounded-md bg-muted p-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 truncate text-sm font-semibold text-foreground">
          {value}
        </div>
      </div>
    </div>
  </div>
);

const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <div className="mt-1 text-sm font-medium leading-relaxed text-foreground">
      {children}
    </div>
  </div>
);

export default CRMOportunidadShow;
