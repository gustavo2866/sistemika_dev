/**
 * Formulario CABECERA para PoSolicitudes
 * 
 * Contiene solo la lógica relacionada con datos principales:
 * - Datos generales (título, proveedor, tipo solicitud, etc.)
 * - Imputación (departamento, centro costo, oportunidad)
 * - Headers y resúmenes
 * - Lógica principal del formulario
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { required, useGetIdentity } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { getOportunidadIdFromLocation } from "@/lib/oportunidad-context";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { CompactOportunidadSelector } from "../crm-oportunidades";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormDetailSection,
  FormLayout,
  useAutoInitializeField,
} from "@/components/forms";
import {
  HeaderSummaryDisplay,
  useReferenceFieldWatcher,
  useProveedorWatcher,
  useCentroCostoWatcher,
  ConditionalFieldLock,
  StandardFormGrid,
  createTwoColumnSection,
} from "@/components/generic";
import {
  type PoSolicitud,
  type PoSolicitudDetalle,
  ESTADO_BADGES,
  ESTADO_CHOICES,
  TIPO_COMPRA_CHOICES,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PROVEEDORES_REFERENCE,
  VALIDATION_RULES,
  poSolicitudCabeceraSchema,
  poSolicitudDetalleSchema,
  getArticuloFilterByTipo,
  type WizardPayload,
} from "./model";
import {
  create_wizard_3 as CreateWizard3,
} from "./create_wizard_3";
import { PoSolicitudDetalleContent } from "./form_detalle";
import {
  applyWizardPayload,
  useDepartamentoDefaultByTipo,
  useProveedorDefaults,
  useSyncTotalFromDetalles,
  useTipoSolicitudBloqueado,
  useTipoSolicitudCatalog,
} from "./hooks";

// ============================================
// COMPONENTES DE CABECERA
// ============================================

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
          className="w-full"
          validate={required()}
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
          className="w-full"
          clearable
        />
      </CompactFormField>,
      <ConditionalFieldLock key="tipo" isLocked={tipoSolicitudBloqueado || false} lockReason="Bloqueado por tener artículos">
        <ReferenceInput source="tipo_solicitud_id" reference="tipos-solicitud" label="Tipo de solicitud">
          <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
        </ReferenceInput>
      </ConditionalFieldLock>,
      <CompactFormField key="tipo-compra" label="Tipo de compra">
        <CompactSelectInput
          source="tipo_compra"
          choices={TIPO_COMPRA_CHOICES}
          label={false}
          className="w-full"
          validate={required()}
        />
      </CompactFormField>,
      <CompactTextInput
        key="fecha"
        source="fecha_necesidad"
        label="Fecha de necesidad"
        type="date"
        className="w-full"
        validate={required()}
      />,
      <ReferenceInput key="solicitante" source="solicitante_id" reference="users" label="Solicitante">
        <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>,
      <CompactTextInput
        key="comentario"
        source="comentario"
        label="Comentarios"
        multiline
        rows={3}
        className="w-full md:col-span-2"
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
  const { register, setValue, getValues } = useFormContext<PoSolicitud>();
  const shouldLockOportunidad = typeof lockedOportunidadId === "number" && Number.isFinite(lockedOportunidadId);
  
  // Usar el hook genérico para oportunidad locked
  const { data: lockedOportunidadData } = useProveedorWatcher(); // Se puede crear un useOportunidadWatcher similar

  useEffect(() => {
    if (!shouldLockOportunidad) return;
    const currentValue = getValues("oportunidad_id");
    if (currentValue !== lockedOportunidadId) {
      setValue("oportunidad_id", lockedOportunidadId, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [getValues, lockedOportunidadId, setValue, shouldLockOportunidad]);

  const formSections = [
    createTwoColumnSection("", [
      <ReferenceInput key="depto" source="departamento_id" reference="departamentos" label="Departamento">
        <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
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
            className="w-full"
            triggerProps={{ className: "w-full truncate text-left" }}
            validate={required()}
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
            <input type="hidden" {...register("oportunidad_id", { valueAsNumber: true })} />
          ) : null}
        </CompactFormField>
      </div>,
    ]),
  ];

  return <StandardFormGrid sections={formSections} />;
};

// ============================================
// COMPONENTES DE HEADER/RESUMEN (REFACTORIZADOS)
// ============================================

/**
 * Muestra el total estimado usando HeaderSummaryDisplay
 */
const PoSolicitudTotalInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  
  return (
    <HeaderSummaryDisplay
      fields={[{ 
        value: control._formValues?.total ?? 0,
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
  const estadoValue = control._formValues?.estado;
  
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
const PoSolicitudHeaderSummary = () => {
  const { control } = useFormContext<PoSolicitud>();
  const { data: proveedor } = useProveedorWatcher("proveedor_id");
  const tituloValue = control._formValues?.titulo;
  
  const titulo = tituloValue && String(tituloValue).trim().length > 0
    ? String(tituloValue)
    : "Sin titulo";
  const proveedorLabel = proveedor?.nombre?.trim() || "Sin proveedor";

  return (
    <HeaderSummaryDisplay
      fields={[
        { value: titulo, formatter: 'text', className: "min-w-0 max-w-[60%] truncate" },
        { value: proveedorLabel, formatter: 'text', className: "min-w-0 max-w-[40%] truncate" },
      ]}
      separator="-"
      layout="horizontal"
      className="flex w-full items-center gap-2 text-[10px] text-muted-foreground sm:text-xs"
    />
  );
};

/**
 * Resumen de centro de costo y oportunidad (REFACTORIZADO)
 */
const PoSolicitudImputacionSummary = () => {
  const { data: centroCosto } = useCentroCostoWatcher("centro_costo_id");
  const { data: oportunidad } = useReferenceFieldWatcher(
    "oportunidad_id",
    OPORTUNIDADES_REFERENCE.resource,
    { validation: (value) => !!value && typeof value === "object" }
  );
  
  const centroCostoNombre = (centroCosto as { nombre?: string } | undefined)?.nombre;
  const oportunidadTitulo = (oportunidad as { titulo?: string } | undefined)?.titulo;
  const centroCostoLabel = centroCostoNombre?.trim() || "Sin centro de costo";
  const oportunidadLabel = oportunidadTitulo?.trim() || "Sin oportunidad";

  return (
    <HeaderSummaryDisplay
      fields={[
        { value: centroCostoLabel, formatter: 'text', className: "min-w-0 max-w-[55%] truncate" },
        { value: oportunidadLabel, formatter: 'text', className: "min-w-0 max-w-[45%] truncate" },
      ]}
      separator="-"
      layout="horizontal"
      className="flex w-full items-center gap-2 text-[9px] text-muted-foreground sm:text-[10px]"
    />
  );
};

/**
 * Toolbar del formulario
 */
const FormFooter = () => (
  <FormToolbar />
);

// ============================================
// COMPONENTE PRINCIPAL DE CAMPOS
// ============================================

/**
 * Componente principal que contiene toda la lógica de campos y efectos
 */
const PoSolicitudFormFields = ({
  lockedOportunidadId,
  wizardOpen,
  setWizardOpen,
  wizardVariant,
}: {
  lockedOportunidadId?: number;
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  wizardVariant?: string | null;
}) => {
  const form = useFormContext<PoSolicitud>();
  const { data: identity } = useGetIdentity();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const proveedorValue = useWatch({ control, name: "proveedor_id" });
  const detallesValue = useWatch({ control, name: "detalles" });
  const isCreate = !idValue;

  const { tiposSolicitudCatalog } = useTipoSolicitudCatalog();
  
  const proveedorId = useMemo(() => {
    const parsed = Number(proveedorValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [proveedorValue]);
  
  const oportunidadFilter = useMemo(
    () => ({
      activo: true,
    }),
    []
  );

  const articuloFilterId = useMemo(() => {
    return getArticuloFilterByTipo(
      tipoSolicitudValue ? String(tipoSolicitudValue) : undefined,
      tiposSolicitudCatalog
    );
  }, [tipoSolicitudValue, tiposSolicitudCatalog]);

  useProveedorDefaults({ form, proveedorId });

  // Filtros dinámicos para referencias del schema
  const dynamicReferenceFilters = useMemo((): Record<string, Record<string, any>> => {
    if (!articuloFilterId) return {};
    return {
      articulo_id: {
        tipo_articulo_id: articuloFilterId,
      },
    };
  }, [articuloFilterId]);

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

  const handleApplyWizard = (payload: WizardPayload) => {
    const identityIdValue =
      identity?.id != null && Number.isFinite(Number(identity.id))
        ? Number(identity.id)
        : null;
    applyWizardPayload({
      isCreate,
      setValue: form.setValue,
      identityId: identityIdValue,
      payload,
    });
  };

  return (
    <>
      {isCreate && wizardVariant === "asistida" ? (
        <CreateWizard3
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onApply={handleApplyWizard}
        />
      ) : null}
      
      <FormLayout
        sections={[
          {
            id: "datos-generales",
            title: "Cabecera",
            defaultOpen: isCreate ? false : !idValue,
            headerContent: <PoSolicitudHeaderInline />,
            headerContentPosition: "inline",
            headerContentBelow: <PoSolicitudHeaderSummary />,
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
            headerContentBelow: <PoSolicitudImputacionSummary />,
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
  wizardOpen: wizardOpenProp,
  setWizardOpen: setWizardOpenProp,
  wizardVariant,
}: {
  wizardOpen?: boolean;
  setWizardOpen?: (open: boolean) => void;
  wizardVariant?: string | null;
}) => {
  const location = useLocation();
  const [localWizardOpen, setLocalWizardOpen] = useState(false);
  const wizardOpen = wizardOpenProp ?? localWizardOpen;
  const setWizardOpen = setWizardOpenProp ?? setLocalWizardOpen;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => poSolicitudCabeceraSchema.defaults(),
    []
  );
  const oportunidadIdFromLocation = useMemo(
    () => getOportunidadIdFromLocation(location),
    [location]
  );

  const defaultValues = useMemo(() => {
    const solicitanteDefault =
      cabeceraDefaults.solicitante_id &&
      cabeceraDefaults.solicitante_id.trim().length > 0
        ? Number(cabeceraDefaults.solicitante_id)
        : undefined;
    const centroCostoParsed =
      cabeceraDefaults.centro_costo_id &&
      cabeceraDefaults.centro_costo_id.trim().length > 0
        ? Number(cabeceraDefaults.centro_costo_id)
        : 1;
    const centroCostoDefault = Number.isFinite(centroCostoParsed)
      ? centroCostoParsed
      : 1;
    const oportunidadDefault = Number.isFinite(oportunidadIdFromLocation)
      ? oportunidadIdFromLocation
      : undefined;
    return {
      ...cabeceraDefaults,
      fecha_necesidad: cabeceraDefaults.fecha_necesidad || today,
      solicitante_id: solicitanteDefault,
      centro_costo_id: centroCostoDefault,
      oportunidad_id: oportunidadDefault ?? cabeceraDefaults.oportunidad_id,
      total: 0,
      detalles: [] as PoSolicitudDetalle[],
    };
  }, [cabeceraDefaults, today, oportunidadIdFromLocation]);

  return (
    <SimpleForm
      defaultValues={defaultValues}
      toolbar={<FormFooter />}
    >
      <PoSolicitudFormFields
        lockedOportunidadId={oportunidadIdFromLocation}
        wizardOpen={wizardOpen}
        setWizardOpen={setWizardOpen}
        wizardVariant={wizardVariant}
      />
    </SimpleForm>
  );
};

