"use client";

import { required, useDataProvider, useRecordContext } from "ra-core";

import { SimpleForm } from "@/components/simple-form";
import {
  FormDate,
  FormErrorSummary,
  FormBoolean,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  type Propiedad,
  type PropiedadFormValues,
  type Vacancia,
} from "./model";

export const PropiedadForm = () => (
  <SimpleForm<PropiedadFormValues>
    className="w-full max-w-4xl"
    warnWhenUnsavedChanges
    validate={useNombreUnicoFormValidator()}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Cabecera"
      main={<CabeceraFields />}
      optional={<CabeceraOpcionales />}
      defaultOpen
    />
    {/* Datos generales ahora van como opcionales de Cabecera */}
    <SectionBaseTemplate title="Datos del contrato" main={<DatosContratoFields />} defaultOpen={false} />
    <SectionBaseTemplate title="Vacancias" main={<PropiedadVacanciasTable />} defaultOpen={false} />
  </SimpleForm>
);

const CabeceraFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-full" />
    <FormText source="propietario" label="Propietario" validate={required()} widthClass="w-full" />
    <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo propiedad">
      <FormSelect optionText="nombre" label="Tipo propiedad" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
    <ReferenceInput
      source="tipo_operacion_id"
      reference="crm/catalogos/tipos-operacion"
      label="Tipo de operacion"
    >
      <FormSelect optionText="nombre" label="Tipo de operacion" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
  </div>
);

const useNombreUnicoFormValidator = () => {
  const dataProvider = useDataProvider();
  const record = useRecordContext<Propiedad>();

  return async (values: PropiedadFormValues) => {
    const normalized = String(values?.nombre ?? "").trim();
    if (!normalized) return {};
    const currentNombre = String(record?.nombre ?? "").trim();
    if (currentNombre && currentNombre.toLowerCase() === normalized.toLowerCase()) {
      return {};
    }
    try {
      const result = await dataProvider.getList<Propiedad>("propiedades-inmobiliaria", {
        filter: { nombre__eq: normalized },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "DESC" },
      });
      const exists = (result.data ?? []).some(
        (item) =>
          String(item?.nombre ?? "").trim().toLowerCase() === normalized.toLowerCase() &&
          item.id !== record?.id,
      );
      return exists ? { nombre: "Ya existe una propiedad con ese nombre" } : {};
    } catch {
      return {};
    }
  };
};

const CabeceraOpcionales = () => (
  <div className="mt-1 space-y-0">
    <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
      <div className="grid gap-2 md:grid-cols-4">
        <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
          <FormSelect optionText="nombre" label="Emprendimiento" widthClass="w-full" emptyText="Sin asignar" />
        </ReferenceInput>
        <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto propietario">
          <FormSelect
            optionText="nombre_completo"
            label="Contacto propietario"
            widthClass="w-full"
            emptyText="Sin asignar"
          />
        </ReferenceInput>
        <FormNumber source="costo_propiedad" label="Costo de la propiedad" step="any" min={0} widthClass="w-full" />
        <ReferenceInput source="costo_moneda_id" reference="monedas" label="Moneda del costo">
          <FormSelect optionText="nombre" label="Moneda del costo" widthClass="w-full" />
        </ReferenceInput>
        <FormDate source="fecha_ingreso" label="Fecha de ingreso" widthClass="w-full" />
        <FormNumber source="ambientes" label="Ambientes" min={0} widthClass="w-full" />
        <FormNumber
          source="metros_cuadrados"
          label="Metros cuadrados"
          min={0}
          step={0.1}
          widthClass="w-full"
        />
        <ReferenceInput source="propiedad_status_id" reference="propiedades-status" label="Estado (catalogo)">
          <FormSelect optionText="nombre" label="Estado (catalogo)" widthClass="w-full" emptyText="Sin asignar" />
        </ReferenceInput>
        <FormTextarea
          source="estado_comentario"
          label="Comentario"
          widthClass="w-full"
          className="md:col-span-4 [&_textarea]:min-h-[64px]"
        />
      </div>
    </div>
  </div>
);


const DatosContratoFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormNumber source="valor_alquiler" label="Valor alquiler" step="any" min={0} widthClass="w-full" />
    <FormNumber source="expensas" label="Expensas" step="any" min={0} widthClass="w-full" />
    <FormDate source="vencimiento_contrato" label="Vencimiento contrato" widthClass="w-full" />
  </div>
);

const PropiedadVacanciasTable = () => {
  const record = useRecordContext<Propiedad>();
  const vacancias = (record?.vacancias ?? []) as Vacancia[];

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-AR");
  };

  if (!record?.id) {
    return <p className="text-xs text-muted-foreground">Disponible despues de guardar la propiedad.</p>;
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
            <TableHead className="px-2 py-1">Realizada</TableHead>
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
