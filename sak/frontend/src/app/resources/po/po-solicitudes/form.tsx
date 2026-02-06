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
import { CircleX, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react";
import { getOportunidadIdFromLocation, getReturnToFromLocation } from "@/lib/oportunidad-context";
import { SaveButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import { formatOportunidadLabel } from "../../crm-oportunidades/OportunidadSelector";
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
  useCentroCostoWatcher,
  useReferenceFieldWatcher,
} from "@/components/generic";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  type PoSolicitud,
  TIPO_COMPRA_CHOICES,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
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
  useSyncTotalFromDetalles,
} from "../shared/po-hooks";
import { PODetalleHeaderRow, POTotalInline } from "../shared/po-components";
import { PoSolicitudDetalleContent } from "./form_detalle";
import {
  useDepartamentoDefaultByTipo,
  usePoSolicitudSectionSubtitles,
  PoSolicitudSectionSubtitle,
  useProveedorDefaults,
  useTipoSolicitudBloqueado,
} from "./form_hooks";
import { FormActionsMenuButton } from "@/components/forms";
import { FormActions } from "./form_actions";
import { FormCotizar } from "./form_cotizar";
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
  const [showExtraFields, setShowExtraFields] = useState(false);
  const formSections = [
    createTwoColumnSection("", [
      <div key="titulo" className="min-w-0">
        <CompactTextInput
          source="titulo"
          label="Titulo"
          required
          maxLength={50}
        />
      </div>,
      <ReferenceInput
        key="solicitante"
        source="solicitante_id"
        reference="users"
        label="Solicitante"
      >
        <CompactSelectInput optionText="nombre" required />
      </ReferenceInput>,
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
      <div key="imputacion" className="md:col-span-2">
        <ImputacionContent oportunidadFilter={OPORTUNIDAD_FILTER} />
      </div>,
      <div key="fecha" className="max-w-[160px]">
        <CompactDateInput
          source="fecha_necesidad"
          label="Fecha Nec"
          required
        />
      </div>,
      <div key="extra-toggle" className="flex items-center">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-muted-foreground"
          onClick={() => setShowExtraFields((prev) => !prev)}
        >
          {showExtraFields ? "menos..." : "mas..."}
        </Button>
      </div>,
      showExtraFields ? (
        <CompactFormField key="tipo-compra" label="Tipo de compra">
          <CompactSelectInput
            source="tipo_compra"
            choices={TIPO_COMPRA_CHOICES}
            label={false}
            required
          />
        </CompactFormField>
      ) : (
        <div key="tipo-compra-placeholder" />
      ),
    ]),
    {
      columns: 2 as const,
      fields: [
        {
          span: 2,
          component: (
            showExtraFields ? (
              <CompactTextInput
                key="comentario"
                source="comentario"
                label="Comentarios"
                multiline
                rows={3}
                className="md:col-span-2"
              />
            ) : null
          ),
        },
      ],
    },
  ];

  return <StandardFormGrid sections={formSections} />;
};

//  Contenido de la sección Imputación (REFACTORIZADO)
const ImputacionContent = ({
  oportunidadFilter,
}: {
  oportunidadFilter?: Record<string, unknown>;
}) => {
  const { control } = useFormContext<PoSolicitud>();
  const [showImputacionFields, setShowImputacionFields] = useState(false);
  const centroCostoValue = useWatch({ control, name: "centro_costo_id" });
  const oportunidadValue = useWatch({ control, name: "oportunidad_id" });
  const { data: centroCostoData } = useCentroCostoWatcher("centro_costo_id");
  const { data: oportunidadData } = useReferenceFieldWatcher(
    "oportunidad_id",
    OPORTUNIDADES_REFERENCE.resource,
    { validation: (value) => !!value && typeof value === "object" }
  );

  const oportunidadLabel = useMemo(() => {
    if (oportunidadData && typeof oportunidadData === "object") {
      return formatOportunidadLabel(oportunidadData);
    }
    if (typeof oportunidadValue === "object" && oportunidadValue) {
      return formatOportunidadLabel(oportunidadValue);
    }
    if (oportunidadValue) return `#${oportunidadValue}`;
    return "";
  }, [oportunidadData, oportunidadValue]);

  const centroCostoLabel = useMemo(() => {
    if (centroCostoData && typeof centroCostoData === "object") {
      return String((centroCostoData as { nombre?: string }).nombre ?? "");
    }
    if (centroCostoValue) return `#${centroCostoValue}`;
    return "";
  }, [centroCostoData, centroCostoValue]);

  const imputacionLabel = oportunidadLabel
    ? `Oportunidad: ${oportunidadLabel}`
    : centroCostoLabel
      ? `Centro costo: ${centroCostoLabel}`
      : "";

  return (
    <div className="w-full">
      <CompactFormField label="Imputacion" className="w-full">
        <div className="relative w-full">
          <Input
            type="text"
            value={imputacionLabel || "-"}
            readOnly
            tabIndex={-1}
            className="h-7 w-full bg-muted/50 pr-9 text-[11px] sm:h-8 sm:text-sm"
          />
        <Button
          type="button"
          variant="outline"
          size="icon"
          tabIndex={-1}
          onClick={() => setShowImputacionFields((prev) => !prev)}
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md border-border bg-background p-0 text-muted-foreground shadow-none transition hover:text-foreground"
          aria-label={
            showImputacionFields
              ? "Ocultar imputacion"
              : "Editar imputacion"
          }
        >
          <PencilLine className="h-3 w-3" />
        </Button>
      </div>
        {showImputacionFields ? (
          <div className="mt-2 rounded-md border border-border/70 bg-muted/10 p-2 sm:p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CompactFormField label="Centro de costo">
                <ReferenceInput
                  source="centro_costo_id"
                  reference={CENTROS_COSTO_REFERENCE.resource}
                  label={false}
                  filter={CENTROS_COSTO_REFERENCE.filter}
                >
                  <CompactSelectInput
                    optionText="nombre"
                    label={false}
                    triggerProps={{ className: "w-full truncate text-left" }}
                  />
                </ReferenceInput>
              </CompactFormField>
              <CompactFormField label="Oportunidad">
                <CompactOportunidadSelector
                  source="oportunidad_id"
                  placeholder="Selecciona una oportunidad"
                  filter={oportunidadFilter}
                  clearable
                />
              </CompactFormField>
            </div>
          </div>
        ) : null}
      </CompactFormField>
    </div>
  );
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
        <FormCotizar onClose={onCancel} />
      </div>
    </FormToolbar>
  );
};

//#endregion

//*********************************
// region 5. FORM
//#region 

// Componente principal que contiene toda la lógica de campos y efectos
const PoSolicitudFormFields = () => {
  const form = useFormContext<PoSolicitud>();
  const { control, register } = form;
  const record = useRecordContext<PoSolicitud>();
  const idValue = useWatch({ control, name: "id" });
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const proveedorValue = useWatch({ control, name: "proveedor_id" });
  const tipoCompraValue = useWatch({ control, name: "tipo_compra" });
  const detallesValue = useWatch({ control, name: "detalles" });
  const isCreate = !idValue;

  const { cabeceraSubtitle, tiposSolicitudCatalog } =
    usePoSolicitudSectionSubtitles();
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
      <PoSolicitudFormFields />
    </SimpleForm>
  );
};

//#endregion
