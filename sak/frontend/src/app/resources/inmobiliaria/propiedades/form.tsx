"use client";

import { useMemo } from "react";
import { ListBase, required, useDataProvider, useGetList, useRecordContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";

import { SimpleForm } from "@/components/simple-form";
import {
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { CRMOportunidadListBody } from "@/app/resources/crm/crm-oportunidades/List";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { ReferenceInput } from "@/components/reference-input";

import {
  type Propiedad,
  type PropiedadFormValues,
  excludeMantenimientoTipoOperacion,
  isTipoOperacionMantenimiento,
} from "./model";

export const PropiedadForm = () => (
  <SimpleForm<PropiedadFormValues>
    className="w-full max-w-4xl"
    warnWhenUnsavedChanges
    validate={useNombreUnicoFormValidator() as any}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Cabecera"
      main={<CabeceraFields />}
      optional={<CabeceraOpcionales />}
      defaultOpen
    />
    <OportunidadesSection />
    <ReparacionesSection />
    {/* Datos generales ahora van como opcionales de Cabecera */}
    <SectionBaseTemplate title="Datos del contrato" main={<DatosContratoFields />} defaultOpen={false} />
  </SimpleForm>
);

const CabeceraFields = () => (
  <div className="grid gap-2 md:grid-cols-4">
    <FormText source="nombre" label="Nombre" validate={required()} widthClass="w-full" />
    <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo propiedad">
      <FormSelect optionText="nombre" label="Tipo propiedad" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
    <ReferenceInput
      source="tipo_operacion_id"
      reference="crm/catalogos/tipos-operacion"
      label="Tipo de operacion"
    >
      <FormSelect
        optionText="nombre"
        label="Tipo de operacion"
        widthClass="w-full"
        emptyText="Sin asignar"
        choicesFilter={excludeMantenimientoTipoOperacion}
      />
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
      const result = await dataProvider.getList<Propiedad>("propiedades", {
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
    <ReferenceInput source="propietario_id" reference="propietarios" label="Propietario">
      <FormSelect optionText="nombre" label="Propietario" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
    <FormNumber source="valor_alquiler" label="Valor alquiler" step="any" min={0} widthClass="w-full" />
    <FormNumber source="expensas" label="Expensas" step="any" min={0} widthClass="w-full" />
    <FormDate source="fecha_inicio_contrato" label="Fecha inicio contrato" widthClass="w-full" />
    <FormDate source="vencimiento_contrato" label="Vencimiento contrato" widthClass="w-full" />
    <ReferenceInput source="tipo_actualizacion_id" reference="tipos-actualizacion" label="Tipo actualizacion">
      <FormSelect optionText="nombre" label="Tipo actualizacion" widthClass="w-full" emptyText="Sin asignar" />
    </ReferenceInput>
    <FormDate source="fecha_renovacion" label="Fecha renovacion" widthClass="w-full" />
  </div>
);
const OportunidadesSection = () => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const tipoOperacionId = record?.tipo_operacion_id ?? null;

  return (
    <OportunidadesListSection
      title="Oportunidades"
      propiedadId={propiedadId}
      tipoOperacionId={tipoOperacionId}
      persistKey={`propiedades-oportunidades-${propiedadId ?? "sin-propiedad"}`}
      storeKey={`crm-oportunidades-propiedad-${propiedadId ?? "sin-propiedad"}`}
    />
  );
};

const useMantenimientoTipoOperacionId = () => {
  const { data: tiposOperacion } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  return useMemo(() => {
    const mantenimiento = (tiposOperacion ?? []).find((tipo: any) => isTipoOperacionMantenimiento(tipo));
    return mantenimiento?.id ?? null;
  }, [tiposOperacion]);
};

const ReparacionesSection = () => {
  const record = useRecordContext<Propiedad>();
  const propiedadId = record?.id;
  const tipoOperacionId = useMantenimientoTipoOperacionId();

  return (
    <OportunidadesListSection
      title="Reparaciones"
      propiedadId={propiedadId}
      tipoOperacionId={tipoOperacionId}
      persistKey={`propiedades-reparaciones-${propiedadId ?? "sin-propiedad"}`}
      storeKey={`crm-oportunidades-reparaciones-${propiedadId ?? "sin-propiedad"}`}
    />
  );
};

type OportunidadesListSectionProps = {
  title: string;
  propiedadId?: number;
  tipoOperacionId: number | null;
  persistKey: string;
  storeKey: string;
};

const OportunidadesListSection = ({
  title,
  propiedadId,
  tipoOperacionId,
  persistKey,
  storeKey,
}: OportunidadesListSectionProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedPropiedadId = propiedadId ?? null;
  const returnTo = `${location.pathname}${location.search}`;

  const createTo = useMemo(() => {
    const basePath = "/crm/oportunidades/create";
    const params = new URLSearchParams();
    if (resolvedPropiedadId) {
      params.set("propiedad_id", String(resolvedPropiedadId));
    }
    params.set("returnTo", returnTo);
    return `${basePath}?${params.toString()}`;
  }, [resolvedPropiedadId, returnTo]);

  const defaultFilters = useMemo(
    () => ({
      propiedad_id: resolvedPropiedadId,
      activo: true,
      tipo_operacion_id: tipoOperacionId ?? null,
    }),
    [resolvedPropiedadId, tipoOperacionId],
  );

  if (!resolvedPropiedadId) {
    return null;
  }

  return (
    <ListBase
      resource="crm/oportunidades"
      perPage={10}
      sort={{ field: "created_at", order: "DESC" }}
      filterDefaultValues={defaultFilters}
      disableSyncWithLocation
      storeKey={storeKey}
    >
      <SectionBaseTemplate
        title={title}
        defaultOpen={false}
        persistKey={persistKey}
        actions={
          <DropdownMenuItem
            onSelect={(event) => {
              event.stopPropagation();
              navigate(createTo);
            }}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Plus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Agregar oportunidad
          </DropdownMenuItem>
        }
        main={<CRMOportunidadListBody compact showBulkActions={false} />}
      />
    </ListBase>
  );
};
