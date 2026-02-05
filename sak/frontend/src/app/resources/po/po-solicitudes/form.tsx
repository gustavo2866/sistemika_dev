/**
 * Formulario CABECERA para PoSolicitudes.
 *
 * Estructura:
 * 1. TIPOS - Tipos y contratos del formulario
 * 2. SECCIONES - Render de secciones (cabecera e imputacion)
 * 3. RESUMEN - Widgets de header y totales
 * 4. FOOTER - Acciones y emision
 * 5. FORM - Orquestacion principal del formulario
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useRecordContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleX, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { getOportunidadIdFromLocation, getReturnToFromLocation } from "@/lib/oportunidad-context";
import { SaveButton } from "@/components/form";
import { Button } from "@/components/ui/button";
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
  ConditionalFieldLock,
  StandardFormGrid,
  createTwoColumnSection,
} from "@/components/generic";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  type PoSolicitud,
  TIPO_COMPRA_CHOICES,
  CENTROS_COSTO_REFERENCE,
  PROVEEDORES_REFERENCE,
  VALIDATION_RULES,
  buildPoSolicitudDefaultValues,
  calculateTotal,
  poSolicitudCabeceraSchema,
  poSolicitudDetalleSchema,
} from "./model";
import { resolveTipoCompra } from "./transformers";
import {
  useArticuloFilterByTipoSolicitud,
  useLockedOportunidadField,
  useSyncTotalFromDetalles,
  useMutuallyExclusiveFields,
} from "../shared/po-hooks";
import { PODetalleHeaderRow, POTotalInline } from "../shared/po-components";
import { PoSolicitudDetalleContent } from "./form_detalle";
import {
  useDepartamentoDefaultByTipo,
  usePoSolicitudSectionSubtitles,
  PoSolicitudSectionSubtitle,
  useImputacionVisibilityByDetalle,
  useProveedorDefaults,
  useTipoSolicitudBloqueado,
} from "./form_hooks";
import { FormActionsMenuButton } from "@/components/forms";
import { FormActions } from "./form_actions";
import { FormEmitir } from "./form_emitir";
import { FormConfirmar } from "./form_confirmar";

const OPORTUNIDAD_FILTER = { activo: true };

//*********************************
// region 1. TIPOS
//#region 

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

//#endregion


//*********************************
// region 2. SECCIONES
//#region 

// Contenido de la sección Datos Generales (REFACTORIZADO)
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

//  Contenido de la sección Imputación (REFACTORIZADO)
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
            disabled={shouldLockOportunidad}
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

//#endregion

//*********************************
// region 3. RESUMEN
//#region 



//#endregion

//*********************************
// region 4. FOOTER
//#region 


// Toolbar del formulario con acciones principales.
const FormFooter = ({ onCancel }: { onCancel: () => void }) => {
  return (
    <FormToolbar>
      <div className="flex flex-row gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm cursor-pointer"
        >
          <CircleX className="size-3 sm:size-4" />
          Cancelar
        </Button>
        <SaveButton variant="secondary" />
        <FormConfirmar />
        <FormEmitir onClose={onCancel} />
      </div>
    </FormToolbar>
  );
};

//#endregion

//*********************************
// region 5. FORM
//#region 

// Componente principal que contiene toda la lógica de campos y efectos
const PoSolicitudFormFields = ({
  lockedOportunidadId,
}: {
  lockedOportunidadId?: number;
}) => {
  const form = useFormContext<PoSolicitud>();
  const { control, register } = form;
  const record = useRecordContext<PoSolicitud>();
  const idValue = useWatch({ control, name: "id" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const proveedorValue = useWatch({ control, name: "proveedor_id" });
  const tipoCompraValue = useWatch({ control, name: "tipo_compra" });
  const detallesValue = useWatch({ control, name: "detalles" });
  const isCreate = !idValue;

  const { cabeceraSubtitle, imputacionSubtitle, tiposSolicitudCatalog } =
    usePoSolicitudSectionSubtitles();
  const {
    showImputacion,
    imputacionOpen,
    handleDetalleOpen,
    handleDetalleClose,
    handleImputacionToggle,
  } = useImputacionVisibilityByDetalle();
  const [detalleActions, setDetalleActions] = useState<{
    handleStartCreate: () => void;
    handleClearAll: () => void;
  } | null>(null);
  const handleRegisterDetalleActions = useCallback(
    (actions: { handleStartCreate: () => void; handleClearAll: () => void }) => {
      setDetalleActions((prev) => {
        if (
          prev?.handleStartCreate === actions.handleStartCreate &&
          prev?.handleClearAll === actions.handleClearAll
        ) {
          return prev;
        }
        return actions;
      });
    },
    []
  );
  
  const proveedorId = useMemo(() => {
    const parsed = Number(proveedorValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [proveedorValue]);

  useEffect(() => {
    if (!proveedorId) return;
    if (typeof tipoCompraValue === "string" && tipoCompraValue.trim().length > 0) {
      return;
    }
    form.setValue("tipo_compra", resolveTipoCompra(proveedorId), {
      shouldDirty: false,
    });
  }, [form, proveedorId, tipoCompraValue]);
  
  const oportunidadFilter = OPORTUNIDAD_FILTER;
  const handleDetalleMenuClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const handleDetalleMenuAction = (
    event: React.MouseEvent,
    action?: () => void
  ) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  };

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
  useSyncTotalFromDetalles({
    form,
    detallesValue,
    calculateTotal: (detalles) =>
      calculateTotal(detalles as PoSolicitud["detalles"]),
  });

  useAutoInitializeField("solicitante_id", "id", !idValue);

  useEffect(() => {
    if (!record?.estado) return;
    const currentEstado = form.getValues("estado");
    if (typeof currentEstado === "string" && currentEstado.trim().length > 0) {
      return;
    }
    form.setValue("estado", record.estado, { shouldDirty: false });
  }, [form, record?.estado]);

  return (
    <>
      <input type="hidden" {...register("estado")} />
      <FormLayout
        sections={[
          {
            id: "datos-generales",
            title: "Cabecera",
            defaultOpen: isCreate ? false : !idValue,
            headerContent: <FormActions />,
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
          ...(showImputacion
            ? [
                {
                  id: "imputacion",
                  title: "Imputación",
                  defaultOpen: false,
                  open: imputacionOpen,
                  onToggle: handleImputacionToggle,
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
              ]
            : []),
          {
            id: "articulos",
            title: "Detalle",
            defaultOpen: false,
            contentPadding: "none",
            contentClassName: "space-y-2 px-1 sm:px-1",
            headerContent: (
              <PODetalleHeaderRow
                onAdd={detalleActions?.handleStartCreate}
                menuContent={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <FormActionsMenuButton onClick={handleDetalleMenuClick}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Opciones de detalle</span>
                      </FormActionsMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-[10px] sm:text-xs">
                      <DropdownMenuItem
                        onClick={(event) =>
                          handleDetalleMenuAction(event, detalleActions?.handleStartCreate)
                        }
                        disabled={!detalleActions?.handleStartCreate}
                      >
                        <Plus className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        Agregar articulo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(event) =>
                          handleDetalleMenuAction(event, detalleActions?.handleClearAll)
                        }
                        disabled={!detalleActions?.handleClearAll}
                      >
                        <Trash2 className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        Limpiar todo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            ),
            headerContentPosition: "inline",
            headerContentBelow: <POTotalInline />,
            onOpen: handleDetalleOpen,
            onClose: handleDetalleClose,
            children: (
              <FormDetailSection
                name="detalles"
                schema={poSolicitudDetalleSchema}
                minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
                dynamicFilters={dynamicReferenceFilters}
                onRegisterActions={handleRegisterDetalleActions}
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

//  Componente principal del formulario de PoSolicitudes
export const PoSolicitudForm = ({
  children,
}: {
  children?: ReactNode;
}) => {
  const record = useRecordContext<PoSolicitud>();
  const isEditMode = Boolean(record?.id);
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useMemo(() => getReturnToFromLocation(location), [location]);
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
      defaultValues={isEditMode ? undefined : defaultValues}
      toolbar={<FormFooter onCancel={() => navigate(returnTo ?? "/po-solicitudes")} />}
    >
      {children}
      <PoSolicitudFormFields
        lockedOportunidadId={oportunidadIdFromLocation}
      />
    </SimpleForm>
  );
};

//#endregion
