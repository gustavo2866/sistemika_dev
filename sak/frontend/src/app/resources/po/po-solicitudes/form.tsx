/**
 * Formulario CABECERA para PoSolicitudes.
 *
 * Estructura:
 * 1. TIPOS - Tipos y contratos del formulario
 * 2. ESQUEMAS - Schema de cabecera del formulario
 * 3. SECCIONES - Render de secciones (cabecera e imputacion)
 * 4. RESUMEN - Widgets de header y totales
 * 5. FORM - Orquestacion principal del formulario
 */



"use client";

import { useMemo, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { getOportunidadIdFromLocation } from "@/lib/oportunidad-context";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactFormSection,
  CompactSelectInput,
  CompactDateInput,
  CompactTextInput,
  FormDetailSection,
  FormLayout,
  useAutoInitializeField,
} from "@/components/forms";
import {
  HeaderSummaryDisplay,
  ConditionalFieldLock,
  StandardFormGrid,
  createTwoColumnSection,
} from "@/components/generic";
import { createEntitySchema, referenceField, selectField, stringField } from "@/lib/form-detail-schema";
import {
  type PoSolicitud,
  ESTADO_BADGES,
  ESTADO_CHOICES,
  TIPO_COMPRA_CHOICES,
  TIPOS_SOLICITUD_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  USERS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PROVEEDORES_REFERENCE,
  VALIDATION_RULES,
  buildPoSolicitudDefaultValues,
} from "./model";
import {
  useArticuloFilterByTipoSolicitud,
  useLockedOportunidadField,
  useMutuallyExclusiveFields,
} from "../shared/po-hooks";
import {
  PoSolicitudDetalleContent,
  poSolicitudDetalleSchema,
} from "./form_detalle";
import {
  useDepartamentoDefaultByTipo,
  usePoSolicitudSectionSubtitles,
  PoSolicitudSectionSubtitle,
  useProveedorDefaults,
  useSyncTotalFromDetalles,
  useTipoSolicitudBloqueado,
} from "./form_hooks";

const OPORTUNIDAD_FILTER = { activo: true };

//*********************************
// region 1. TIPOS

// Tipos de cabecera para formulario.
export type PoSolicitudCabeceraFormValues = {
  titulo: string;
  tipo_solicitud_id: string;
  departamento_id: string;
  centro_costo_id: string;
  estado: string;
  tipo_compra: string;
  fecha_necesidad: string;
  solicitante_id: string;
  comentario: string;
  oportunidad_id: string;
  proveedor_id: string;
};

// endregion

//*********************************
// region 2. ESQUEMAS

// Esquema de formulario para cabecera de PoSolicitud.
export const poSolicitudCabeceraSchema = createEntitySchema<
  PoSolicitudCabeceraFormValues,
  Pick<
    PoSolicitud,
    | "titulo"
    | "tipo_solicitud_id"
    | "departamento_id"
    | "centro_costo_id"
    | "estado"
    | "tipo_compra"
    | "fecha_necesidad"
    | "solicitante_id"
    | "comentario"
    | "oportunidad_id"
    | "proveedor_id"
  >
>({
  fields: {
    titulo: stringField({
      required: true,
      trim: true,
      maxLength: 200,
      defaultValue: "",
    }),
    tipo_solicitud_id: referenceField({
      resource: TIPOS_SOLICITUD_REFERENCE.resource,
      labelField: TIPOS_SOLICITUD_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    departamento_id: referenceField({
      resource: DEPARTAMENTOS_REFERENCE.resource,
      labelField: DEPARTAMENTOS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    centro_costo_id: referenceField({
      resource: CENTROS_COSTO_REFERENCE.resource,
      labelField: CENTROS_COSTO_REFERENCE.labelField,
      required: true,
      defaultValue: "1",
    }),
    estado: selectField({
      required: false,
      options: ESTADO_CHOICES,
      defaultValue: "borrador",
    }),
    tipo_compra: selectField({
      required: true,
      options: TIPO_COMPRA_CHOICES,
      defaultValue: "normal",
    }),
    fecha_necesidad: stringField({
      required: true,
      defaultValue: "",
    }),
    solicitante_id: referenceField({
      resource: USERS_REFERENCE.resource,
      labelField: USERS_REFERENCE.labelField,
      required: true,
      defaultValue: "",
    }),
    comentario: stringField({
      trim: true,
      maxLength: VALIDATION_RULES.GENERAL.MAX_COMENTARIO_LENGTH,
      defaultValue: "",
    }),
    oportunidad_id: referenceField({
      resource: OPORTUNIDADES_REFERENCE.resource,
      labelField: OPORTUNIDADES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
    proveedor_id: referenceField({
      resource: PROVEEDORES_REFERENCE.resource,
      labelField: PROVEEDORES_REFERENCE.labelField,
      required: false,
      defaultValue: "",
    }),
  },
});

// endregion

//*********************************
// region 3. SECCIONES

/**
 * Contenido de la sección Datos Generales (REFACTORIZADO)
 */
const DatosGeneralesContent = ({ tipoSolicitudBloqueado }: { tipoSolicitudBloqueado?: boolean }) => {
  const formSections = [
    createTwoColumnSection("", [
      <div key="titulo" className="min-w-0 md:col-span-2">
        <CompactTextInput
          source="titulo"
          label="Titulo"
          required
          maxLength={50}
        />
      </div>,
    ]),
    createTwoColumnSection("", [
      <CompactFormField key="proveedor" label="Proveedor">
        <CompactComboboxQuery
          {...PROVEEDORES_REFERENCE}
          source="proveedor_id"
          placeholder="Selecciona un proveedor"
          clearable
        />
      </CompactFormField>,
      <ConditionalFieldLock key="tipo" isLocked={tipoSolicitudBloqueado || false} lockReason="Bloqueado por tener artículos">
        <ReferenceInput source="tipo_solicitud_id" reference="tipos-solicitud" label="Tipo de solicitud">
          <CompactSelectInput optionText="nombre" required />
        </ReferenceInput>
      </ConditionalFieldLock>,
      <CompactFormField key="tipo-compra" label="Tipo de compra">
        <CompactSelectInput
          source="tipo_compra"
          choices={TIPO_COMPRA_CHOICES}
          label={false}
          required
        />
      </CompactFormField>,
      <CompactDateInput
        key="fecha"
        source="fecha_necesidad"
        label="Fecha de necesidad"
        required
      />,
      <ReferenceInput key="solicitante" source="solicitante_id" reference="users" label="Solicitante">
        <CompactSelectInput optionText="nombre" required />
      </ReferenceInput>,
      <CompactTextInput
        key="comentario"
        source="comentario"
        label="Comentarios"
        multiline
        rows={3}
        className="md:col-span-2"
      />,
    ]),
  ];

  return <StandardFormGrid sections={formSections} />;
};

/**
 * Contenido de la sección Imputación (REFACTORIZADO)
 */
const ImputacionContent = ({
  oportunidadFilter,
  lockedOportunidadId,
}: {
  oportunidadFilter?: Record<string, unknown>;
  lockedOportunidadId?: number;
}) => {
  const { shouldLockOportunidad, lockedOportunidadData, registerOportunidad } =
    useLockedOportunidadField({ lockedOportunidadId });

  useMutuallyExclusiveFields({
    fieldA: "centro_costo_id",
    fieldB: "oportunidad_id",
    clearAWhenB: true,
    clearBWhenA: !shouldLockOportunidad,
  });

  const formSections = [
    createTwoColumnSection("", [
      <ReferenceInput key="depto" source="departamento_id" reference="departamentos" label="Departamento">
        <CompactSelectInput optionText="nombre" required />
      </ReferenceInput>,
      <div key="centro" className="min-w-0 overflow-hidden">
        <ReferenceInput
          source="centro_costo_id"
          reference={CENTROS_COSTO_REFERENCE.resource}
          label="Centro de costo"
          filter={CENTROS_COSTO_REFERENCE.filter}
        >
          <CompactSelectInput
            optionText="nombre"
            triggerProps={{ className: "w-full truncate text-left" }}
            required
          />
        </ReferenceInput>
      </div>,
      <div key="oportunidad" className="md:col-span-2">
        <CompactFormField label="Oportunidad">
          <CompactOportunidadSelector
            source="oportunidad_id"
            placeholder="Selecciona una oportunidad"
            filter={shouldLockOportunidad ? undefined : oportunidadFilter}
            choices={shouldLockOportunidad && lockedOportunidadData ? [lockedOportunidadData] : undefined}
            dependsOn={shouldLockOportunidad ? `locked-${lockedOportunidadId ?? "none"}` : "activo-true"}
            disabled={shouldLockOportunidad}
            clearable={!shouldLockOportunidad}
          />
          {shouldLockOportunidad ? (
            <input type="hidden" {...registerOportunidad()} />
          ) : null}
        </CompactFormField>
      </div>,
    ]),
  ];

  return <StandardFormGrid sections={formSections} />;
};

// endregion

//*********************************
// region 4. RESUMEN

/**
 * Muestra el total estimado usando HeaderSummaryDisplay
 */
const PoSolicitudTotalInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  const total = useWatch({ control, name: "total" });

  return (
    <HeaderSummaryDisplay
      fields={[{ 
        value: total ?? 0,
        formatter: 'currency',
        label: "TOTAL ESTIMADO",
        className: "font-semibold text-primary"
      }]}
      layout="inline"
      className="flex w-full items-center justify-end gap-2 text-[11px] leading-none text-muted-foreground"
    />
  );
};

/**
 * Muestra el estado usando HeaderSummaryDisplay
 */
const PoSolicitudHeaderInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  const estadoValue = useWatch({ control, name: "estado" });
  
  if (!estadoValue) return null;

  const estadoLabel = ESTADO_CHOICES.find((choice) => choice.id === String(estadoValue))?.name || estadoValue;
  const badgeVariant = ESTADO_BADGES[String(estadoValue)] ? "default" : "secondary";
  
  return (
    <HeaderSummaryDisplay
      fields={[{ 
        value: estadoLabel,
        formatter: 'badge',
        badgeVariant,
      }]}
      layout="inline"
      className="flex w-full items-center justify-end"
    />
  );
};

/**
 * Resumen de título y proveedor (REFACTORIZADO)
 */
/**
 * Toolbar del formulario
 */
const FormFooter = () => (
  <FormToolbar />
);

// endregion

//*********************************
// region 5. FORM

/**
 * Componente principal que contiene toda la lógica de campos y efectos
 */
const PoSolicitudFormFields = ({
  lockedOportunidadId,
}: {
  lockedOportunidadId?: number;
}) => {
  const form = useFormContext<PoSolicitud>();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const proveedorValue = useWatch({ control, name: "proveedor_id" });
  const detallesValue = useWatch({ control, name: "detalles" });
  const isCreate = !idValue;

  const { cabeceraSubtitle, imputacionSubtitle, tiposSolicitudCatalog } =
    usePoSolicitudSectionSubtitles();
  
  const proveedorId = useMemo(() => {
    const parsed = Number(proveedorValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [proveedorValue]);
  
  const oportunidadFilter = OPORTUNIDAD_FILTER;

  const { articuloFilterId, dynamicReferenceFilters } =
    useArticuloFilterByTipoSolicitud({
      tipoSolicitudId: tipoSolicitudValue ? String(tipoSolicitudValue) : undefined,
      tiposSolicitudCatalog,
    });

  useProveedorDefaults({ form, proveedorId });

  // Determinar si el tipo de solicitud debe estar bloqueado
  const tipoSolicitudBloqueado = useTipoSolicitudBloqueado(detallesValue);

  useDepartamentoDefaultByTipo({
    form,
    idValue,
    tipoSolicitudValue,
    tiposSolicitudCatalog,
  });
  useSyncTotalFromDetalles({ form, detallesValue });

  useAutoInitializeField("solicitante_id", "id", !idValue);

  return (
    <>
      <FormLayout
        sections={[
          {
            id: "datos-generales",
            title: "Cabecera",
            defaultOpen: isCreate ? false : !idValue,
            headerContent: <PoSolicitudHeaderInline />,
            headerContentPosition: "inline",
            headerContentBelow: (
              <PoSolicitudSectionSubtitle text={cabeceraSubtitle} />
            ),
            contentPadding: "none",
            contentClassName: "space-y-2 px-4 py-2",
            children: (
              <CompactFormSection>
                <DatosGeneralesContent 
                  tipoSolicitudBloqueado={tipoSolicitudBloqueado}
                />
              </CompactFormSection>
            ),
          },
          {
            id: "imputacion",
            title: "Imputación",
            defaultOpen: false,
            headerContentBelow: (
              <PoSolicitudSectionSubtitle text={imputacionSubtitle} />
            ),
            children: (
              <CompactFormSection>
                <ImputacionContent
                  oportunidadFilter={oportunidadFilter}
                  lockedOportunidadId={lockedOportunidadId}
                />
              </CompactFormSection>
            ),
          },
          {
            id: "articulos",
            title: "Detalle",
            defaultOpen: isCreate ? false : true,
            contentPadding: "none",
            contentClassName: "space-y-2 px-1 sm:px-1",
            headerContent: <PoSolicitudTotalInline />,
            headerContentPosition: "inline",
            children: (
              <FormDetailSection
                name="detalles"
                schema={poSolicitudDetalleSchema}
                minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
                dynamicFilters={dynamicReferenceFilters}
              >
                <PoSolicitudDetalleContent articuloFilterId={articuloFilterId} />
              </FormDetailSection>
            ),
          },
        ]}
      />
    </>
  );
};

// ============================================
// COMPONENTE PRINCIPAL EXPORTADO
// ============================================

/**
 * Componente principal del formulario de PoSolicitudes
 */
export const PoSolicitudForm = ({
  children,
}: {
  children?: ReactNode;
}) => {
  const location = useLocation();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => poSolicitudCabeceraSchema.defaults(),
    []
  );
  const oportunidadIdFromLocation = useMemo(
    () => getOportunidadIdFromLocation(location),
    [location]
  );

  const defaultValues = useMemo(
    () =>
      buildPoSolicitudDefaultValues({
        cabeceraDefaults,
        today,
        oportunidadIdFromLocation,
      }),
    [cabeceraDefaults, today, oportunidadIdFromLocation]
  );

  return (
    <SimpleForm
      defaultValues={defaultValues}
      toolbar={<FormFooter />}
    >
      {children}
      <PoSolicitudFormFields
        lockedOportunidadId={oportunidadIdFromLocation}
      />
    </SimpleForm>
  );
};
// endregion
