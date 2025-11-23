"use client";

import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { required, useDataProvider, useRecordContext } from "ra-core";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import type { CRMEvento } from "../crm-eventos/model";
import type { CRMOportunidad } from "./model";
import { CRM_OPORTUNIDAD_ESTADO_CHOICES } from "./model";

export const CRMOportunidadForm = () => (
  <SimpleForm warnWhenUnsavedChanges>
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          children: <DatosGeneralesSection />,
        },
        {
          id: "cotizacion",
          title: "Cotización",
          defaultOpen: false,
          children: <CotizacionSection />,
        },
        {
          id: "eventos",
          title: "Eventos (solo lectura)",
          defaultOpen: false,
          children: <EventosSection />,
        },
      ]}
    />
  </SimpleForm>
);

const DatosGeneralesSection = () => (
  <FormSimpleSection>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
        <SelectInput optionText="nombre_completo" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="responsable_id" reference="users" label="Responsable">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="tipo_operacion_id" reference="crm/catalogos/tipos-operacion" label="Tipo de operación">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <SelectInput
        source="estado"
        label="Estado"
        choices={CRM_OPORTUNIDAD_ESTADO_CHOICES}
        className="w-full"
        defaultValue="1-abierta"
      />
      <TextInput source="fecha_estado" label="Fecha estado" type="datetime-local" className="w-full" />
      <ReferenceInput source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" label="Motivo pérdida">
        <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
      </ReferenceInput>
      <TextInput source="descripcion_estado" label="Descripción" multiline className="md:col-span-2" />
    </div>
  </FormSimpleSection>
);

const CotizacionSection = () => (
  <FormSimpleSection>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
        <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
      </ReferenceInput>
      <NumberInput source="monto" label="Monto" className="w-full" step="any" />
      <ReferenceInput source="moneda_id" reference="monedas" label="Moneda">
        <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
      </ReferenceInput>
      <ReferenceInput source="condicion_pago_id" reference="crm/catalogos/condiciones-pago" label="Condición de pago">
        <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
      </ReferenceInput>
      <NumberInput source="probabilidad" label="Probabilidad (%)" min={0} max={100} className="w-full" />
      <TextInput source="fecha_cierre_estimada" label="Cierre estimado" type="date" className="w-full" />
      <NumberInput source="cotizacion_aplicada" label="Cotización aplicada" step="any" className="w-full" />
    </div>
  </FormSimpleSection>
);

const EventosSection = () => {
  const record = useRecordContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const [eventos, setEventos] = useState<CRMEvento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record?.id) {
      setEventos([]);
      return;
    }
    let cancel = false;
    const fetchEventos = async () => {
      setLoading(true);
      try {
        const response = await dataProvider.getList<CRMEvento>("crm/eventos", {
          filter: { oportunidad_id: record.id },
          pagination: { page: 1, perPage: 25 },
          sort: { field: "fecha_evento", order: "DESC" },
        });
        if (!cancel) {
          setEventos(response.data ?? []);
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };
    fetchEventos();
    return () => {
      cancel = true;
    };
  }, [dataProvider, record?.id]);

  if (!record?.id) {
    return <p className="text-sm text-muted-foreground">Disponible luego de guardar la oportunidad.</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando eventos...</p>;
  }

  if (!eventos.length) {
    return <p className="text-sm text-muted-foreground">Sin eventos asociados.</p>;
  }

  return (
    <FormSimpleSection>
      <div className="max-h-56 overflow-auto">
        <Table className="text-xs">
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
                <TableCell>{evento.tipo?.nombre ?? `#${evento.tipo_id}`}</TableCell>
                <TableCell>{evento.motivo?.nombre ?? `#${evento.motivo_id}`}</TableCell>
                <TableCell>{evento.descripcion}</TableCell>
                <TableCell>{evento.estado_evento}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </FormSimpleSection>
  );
};
