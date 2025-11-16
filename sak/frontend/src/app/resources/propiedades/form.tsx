"use client";

import { required, useDataProvider, useRecordContext } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { SelectInput } from "@/components/select-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { ESTADOS_PROPIEDAD_OPTIONS } from "./model";
import type { Propiedad, Vacancia } from "./model";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

export const PropiedadForm = () => (
  <SimpleForm className="w-full max-w-4xl" warnWhenUnsavedChanges>
    <PropiedadFormContent />
  </SimpleForm>
);

const PropiedadFormContent = () => {
  const form = useFormContext();
  const record = useRecordContext<Propiedad>();
  const watched = form?.watch ? form.watch(["nombre", "propietario", "estado"]) : [];
  const [nombre, propietario, estado] = watched as (string | undefined)[];

  const generalSubtitle = [
    nombre || record?.nombre || "Sin nombre",
    propietario || record?.propietario || "Sin propietario",
    estado || record?.estado || "Sin estado",
  ].join(" · ");

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
                <TextInput source="tipo" label="Tipo" validate={required()} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="propietario" label="Propietario" validate={required()} className="w-full" />
                <SelectInput
                  source="estado"
                  label="Estado actual"
                  choices={ESTADOS_PROPIEDAD_OPTIONS.map((option) => ({
                    id: option.value,
                    name: option.label,
                  }))}
                  className="w-full"
                  validate={required()}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput source="ambientes" label="Ambientes" min={0} className="w-full" />
                <NumberInput source="metros_cuadrados" label="Metros cuadrados" step={0.1} min={0} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="fecha_ingreso" label="Fecha de ingreso" type="date" className="w-full" />
              </div>
              <TextInput
                source="estado_comentario"
                label="Comentario"
                multiline
                rows={4}
                placeholder="Detalle el motivo del ultimo cambio de estado"
                className="w-full"
              />
            </FormSimpleSection>
          ),
        },
        {
          id: "datos-contrato",
          title: "Datos del Contrato",
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput source="valor_alquiler" label="Valor alquiler" step="any" min={0} className="w-full" />
                <NumberInput source="expensas" label="Expensas" step="any" min={0} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  source="vencimiento_contrato"
                  label="Vencimiento contrato"
                  type="date"
                  className="w-full"
                />
              </div>
            </FormSimpleSection>
          ),
        },
        {
          id: "vacancias",
          title: "Vacancia",
          collapsible: true,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <PropiedadVacanciasTable />
            </FormSimpleSection>
          ),
        },
      ]}
    />
  );
};

const PropiedadVacanciasTable = () => {
  const record = useRecordContext<Propiedad>();
  const dataProvider = useDataProvider();
  const [vacancias, setVacancias] = useState<Vacancia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record?.id) {
      setVacancias([]);
      return;
    }

    let cancel = false;
    const fetchVacancias = async () => {
      setLoading(true);
      try {
        const response = await dataProvider.getList<Vacancia>("vacancias", {
          filter: { propiedad_id: record.id },
          pagination: { page: 1, perPage: 50 },
          sort: { field: "created_at", order: "DESC" },
        });
        if (!cancel) {
          setVacancias(response.data ?? []);
        }
      } catch (error) {
        if (!cancel) {
          setVacancias([]);
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };

    fetchVacancias();

    return () => {
      cancel = true;
    };
  }, [dataProvider, record?.id]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-AR");
  };

  if (!record?.id) {
    return <p className="text-xs text-muted-foreground">Disponible despues de guardar la propiedad.</p>;
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Cargando vacancias...</p>;
  }

  if (!vacancias.length) {
    return <p className="text-xs text-muted-foreground">Sin registros de vacancia.</p>;
  }

  return (
    <div className="max-h-56 overflow-x-auto overflow-y-auto">
      <Table className="text-[11px] min-w-[680px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-2 py-1">#</TableHead>
            <TableHead className="px-2 py-1">Estado</TableHead>
            <TableHead className="px-2 py-1">Recibida</TableHead>
            <TableHead className="px-2 py-1">Disp.</TableHead>
            <TableHead className="px-2 py-1">Alquilada</TableHead>
            <TableHead className="px-2 py-1">Retirada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vacancias.map((vacancia) => (
            <TableRow key={vacancia.id} className="hover:bg-transparent">
              <TableCell className="px-2 py-1 font-semibold">#{vacancia.id}</TableCell>
              <TableCell className="px-2 py-1">
                {vacancia.ciclo_activo ? "Activo" : "Cerrado"}
              </TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_recibida)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_disponible)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_alquilada)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_retirada)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

