"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { required, useDataProvider } from "ra-core";
import { useFormContext, useWatch, type UseFormReturn } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  ComboboxQuery,
  FormLayout,
  FormField,
  FormChoiceSelect,
  FormSimpleSection,
  FormDetailSection,
  FormDetailCardList,
  FormDetailCardCompact,
  FormDetailSectionMinItems,
  FormDetailFormDialog,
  FormDetailClearAllButton,
  AddItemButton,
  useAutoInitializeField,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  type PoSolicitud,
  type PoSolicitudDetalle,
  type DetalleFormValues,
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PROVEEDORES_REFERENCE,
  VALIDATION_RULES,
  poSolicitudCabeceraSchema,
  poSolicitudDetalleSchema,
  getArticuloFilterByTipo,
  getDepartamentoDefaultByTipo,
} from "./model";
import type { TipoSolicitud } from "../tipos-solicitud/model";

const GENERAL_SUBTITLE_COMMENT_SNIPPET = 25;

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const ARTICLE_NAME_LIMIT = 30;
const DESCRIPTION_LIMIT = 90;

const truncateText = (value: string, limit: number) => {
  if (!value) return "";
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};

const ESTADO_BADGES: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  en_proceso: "bg-sky-100 text-sky-800",
  finalizada: "bg-slate-200 text-slate-800",
};

const buildGeneralSubtitle = (
  id: number | undefined,
  estado: string | undefined,
  comentario: string | undefined,
  comentarioSnippetLength: number = GENERAL_SUBTITLE_COMMENT_SNIPPET
): string => {
  const snippet = comentario ? comentario.slice(0, comentarioSnippetLength) : "";
  return snippet || "";
};

type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter" | "departamento_default_id"
>;

const PoSolicitudDetalleCard = ({
  item,
  onDelete,
}: {
  item: PoSolicitudDetalle;
  onDelete: () => void;
}) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const articuloLabel =
    item.articulo_nombre ||
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;
  const articuloTitle = truncateText(articuloLabel, ARTICLE_NAME_LIMIT);
  const descripcion = (item.descripcion || "").trim();
  const descripcionTruncada = truncateText(descripcion, DESCRIPTION_LIMIT);
  const showVerMas = descripcion.length > descripcionTruncada.length;
  const unidadMedida = item.unidad_medida || "-";
  const cantidadValue = item.cantidad ?? "-";
  const precioValue = CURRENCY_FORMATTER.format(Number(item.precio ?? 0));
  const importeFormatted = CURRENCY_FORMATTER.format(
    Number(
      typeof item.importe === "number"
        ? item.importe
        : (item.cantidad ?? 0) * (item.precio ?? 0)
    ) || 0
  );

  return (
    <FormDetailCardCompact
      title={
        <div className="flex w-full items-center gap-2">
          <span className="text-[12px] font-semibold sm:text-[13px]">
            {articuloTitle}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-4 w-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label="Eliminar"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2">
          <span className="truncate text-[10px] sm:text-[11px]">
            UM: {unidadMedida}, Precio: {precioValue},{" "}
          </span>
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            Cantidad: {cantidadValue}
          </span>
          <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 text-right text-[10px] font-semibold sm:text-[11px]">
            {importeFormatted}
          </span>
        </div>
      }
    >
      {descripcion ? (
        <>
          <span>{descripcionTruncada}</span>
          {showVerMas ? (
            <span className="ml-1 text-[10px] underline">ver mas</span>
          ) : null}
        </>
      ) : (
        "Artículo sin descripción"
      )}
    </FormDetailCardCompact>
  );
};

interface PoSolicitudDetalleFormProps {
  articuloFilter?: string;
}

type PoSolicitudDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilter?: string;
};

const PoSolicitudDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
  articuloFilter,
}: PoSolicitudDetalleDialogContentProps) => {
  const cantidadValue = detalleForm.watch("cantidad");
  const precioValue = detalleForm.watch("precio");
  const importeValue = detalleForm.watch("importe");
  const importeDisplay = useMemo(() => {
    const asNumber = Number(importeValue ?? 0);
    return Number.isFinite(asNumber) ? asNumber.toFixed(2) : "0.00";
  }, [importeValue]);

  useEffect(() => {
    const cantidad = Number(cantidadValue ?? 0) || 0;
    const precio = Number(precioValue ?? 0) || 0;
    const calculated = Number((cantidad * precio).toFixed(2));
    const currentImporte = Number(importeValue ?? Number.NaN);

    if (
      !Number.isNaN(calculated) &&
      Number.isFinite(calculated) &&
      calculated !== currentImporte
    ) {
      detalleForm.setValue("importe", calculated, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [cantidadValue, precioValue, importeValue, detalleForm]);

  return (
    <>
      <FormField
        label="Artículo"
        error={detalleForm.formState.errors.articulo_id}
        required
      >
        <ComboboxQuery
          {...ARTICULOS_REFERENCE}
          value={detalleForm.watch("articulo_id")}
          onChange={(value: string) =>
            detalleForm.setValue("articulo_id", value, {
              shouldValidate: true,
            })
          }
          placeholder="Selecciona un artículo"
          filter={articuloFilterQuery}
          dependsOn={articuloFilter ?? "all"}
        />
      </FormField>

      <FormField
        label="Descripción"
        error={detalleForm.formState.errors.descripcion}
        required
      >
        <Textarea rows={3} {...detalleForm.register("descripcion")} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormChoiceSelect
          label="Unidad de medida"
          error={detalleForm.formState.errors.unidad_medida}
          required
          choices={UNIDAD_MEDIDA_CHOICES}
          value={detalleForm.watch("unidad_medida")}
          onChange={(value) =>
            detalleForm.setValue("unidad_medida", value, {
              shouldValidate: true,
            })
          }
          placeholder="Selecciona unidad"
        />

        <FormField
          label="Cantidad"
          error={detalleForm.formState.errors.cantidad}
          required
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            {...detalleForm.register("cantidad", { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Precio unitario"
          error={detalleForm.formState.errors.precio}
          required
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            {...detalleForm.register("precio", { valueAsNumber: true, min: 0 })}
          />
        </FormField>

        <FormField
          label="Importe"
          error={detalleForm.formState.errors.importe}
        >
          <Input type="text" value={importeDisplay} readOnly className="bg-muted/50" />
          <input type="hidden" {...detalleForm.register("importe", { valueAsNumber: true })} />
        </FormField>
      </div>
    </>
  );
};

const PoSolicitudDetalleForm = ({ articuloFilter }: PoSolicitudDetalleFormProps) => {
  const articuloFilterQuery = useMemo(
    () => (articuloFilter ? { tipo_articulo: articuloFilter } : undefined),
    [articuloFilter]
  );

  return (
    <FormDetailFormDialog
      title={({ action }) =>
        action === "create" ? "Agregar artículo" : "Editar artículo"
      }
      description="Completa los datos del artículo para la solicitud."
    >
      {(detalleForm) => (
        <PoSolicitudDetalleDialogContent
          detalleForm={detalleForm as unknown as UseFormReturn<DetalleFormValues>}
          articuloFilterQuery={articuloFilterQuery}
          articuloFilter={articuloFilter}
        />
      )}
    </FormDetailFormDialog>
  );
};

const PoSolicitudDetalleContent = ({ articuloFilter }: { articuloFilter?: string }) => {
  const { handleStartCreate, handleDeleteBySortedIndex } = useFormDetailSectionContext();

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 -mt-4 pb-0 pt-0">
        <FormDetailClearAllButton
          size="sm"
          className="h-8 px-3 text-xs"
          confirmMessage="Seguro que deseas eliminar todos los articulos? Esto tambien desbloqueara el tipo de solicitud."
        />
        <AddItemButton
          label="Agregar articulo"
          onClick={handleStartCreate}
          className="h-8 px-3 text-xs"
        />
      </div>
      <FormDetailCardList<PoSolicitudDetalle>
        emptyMessage="Todavia no agregaste articulos."
        showEditAction={false}
        showDeleteAction={false}
        contentClassName="px-2 py-2 sm:px-3"
        gridClassName="grid-cols-[minmax(0,1fr)] items-start gap-2"
        listClassName="mt-1 space-y-1"
        variant="row"
      >
        {(item, index) => (
          <PoSolicitudDetalleCard
            item={item}
            onDelete={() => handleDeleteBySortedIndex(index)}
          />
        )}
      </FormDetailCardList>
      <FormDetailSectionMinItems itemName="articulo" />
      <PoSolicitudDetalleForm articuloFilter={articuloFilter} />
    </>
  );
};

const DatosGeneralesContent = ({ 
  oportunidadFilter, 
  tipoSolicitudBloqueado 
}: { 
  oportunidadFilter?: Record<string, unknown>;
  tipoSolicitudBloqueado?: boolean;
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
    <div className="min-w-0 md:col-span-2">
      <TextInput
        source="titulo"
        label="Titulo"
        className="w-full"
        validate={required()}
        maxLength={50}
      />
    </div>
    
    <div className="min-w-0">
      <ReferenceInput
        source="tipo_solicitud_id"
        reference="tipos-solicitud"
        label="Tipo de solicitud"
      >
        <SelectInput 
          optionText="nombre" 
          className="w-full" 
          validate={required()} 
          disabled={tipoSolicitudBloqueado}
        />
      </ReferenceInput>
    </div>

    <div className="min-w-0">
      <FormField label="Proveedor">
        <ComboboxQuery
          {...PROVEEDORES_REFERENCE}
          source="proveedor_id"
          placeholder="Selecciona un proveedor"
          className="w-full"
          clearable
        />
      </FormField>
    </div>

    <div className="min-w-0">
      <TextInput
        source="fecha_necesidad"
        label="Fecha de necesidad"
        type="date"
        className="w-full"
        validate={required()}
      />
    </div>
    
    <div className="min-w-0">
      <ReferenceInput
        source="solicitante_id"
        reference="users"
        label="Solicitante"
      >
        <SelectInput 
          optionText="nombre" 
          className="w-full" 
          validate={required()} 
        />
      </ReferenceInput>
    </div>

    <TextInput
      source="comentario"
      label="Comentarios"
      multiline
      rows={3}
      className="md:col-span-2"
    />
  </div>
  );
};

const ImputacionContent = ({ oportunidadFilter }: { oportunidadFilter?: Record<string, unknown> }) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
      <div className="min-w-0">
        <ReferenceInput
          source="departamento_id"
          reference="departamentos"
          label="Departamento"
        >
          <SelectInput 
            optionText="nombre" 
            className="w-full" 
            validate={required()} 
          />
        </ReferenceInput>
      </div>
      
      <div className="min-w-0 overflow-hidden">
        <ReferenceInput
          source="centro_costo_id"
          reference={CENTROS_COSTO_REFERENCE.resource}
          label="Centro de costo"
          filter={CENTROS_COSTO_REFERENCE.filter}
        >
          <SelectInput
            optionText="nombre"
            className="w-full"
            triggerProps={{ className: "w-full truncate text-left" }}
            validate={required()}
          />
        </ReferenceInput>
      </div>

      <FormField label="Oportunidad">
        <ComboboxQuery
          {...OPORTUNIDADES_REFERENCE}
          source="oportunidad_id"
          placeholder="Selecciona una oportunidad"
          className="w-full"
          clearable
          filter={oportunidadFilter}
          dependsOn={oportunidadFilter?.tipo_operacion_id ?? "all"}
        />
      </FormField>

    </div>
  );
};

const PoSolicitudFormFields = () => {
  const form = useFormContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const tipoSolicitudPreviousRef = useRef<string | undefined>(undefined);
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const estadoValue = useWatch({ control, name: "estado" });
  const comentarioValue = useWatch({ control, name: "comentario" }) || "";
  const tipoSolicitudValue = useWatch({ control, name: "tipo_solicitud_id" });
  const detallesValue = useWatch({ control, name: "detalles" });

  const { data: tiposSolicitudData } = useQuery<TipoSolicitudCatalog[]>({
    queryKey: ["tipos-solicitud", "defaults"],
    queryFn: async () => {
      const { data } = await dataProvider.getList(
        TIPOS_SOLICITUD_REFERENCE.resource,
        {
          pagination: { page: 1, perPage: TIPOS_SOLICITUD_REFERENCE.limit },
          sort: { field: "nombre", order: "ASC" },
          filter: {},
        }
      );
      return data as TipoSolicitudCatalog[];
    },
    staleTime: TIPOS_SOLICITUD_REFERENCE.staleTime,
  });
  const { data: tiposOperacionData } = useQuery<{ id: number; nombre?: string; codigo?: string }[]>({
    queryKey: ["crm-tipos-operacion", "mantenimiento"],
    queryFn: async () => {
      const { data } = await dataProvider.getList("crm/catalogos/tipos-operacion", {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "nombre", order: "ASC" },
        filter: {},
      });
      return data as { id: number; nombre?: string; codigo?: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const tiposSolicitudCatalog = useMemo(
    () => tiposSolicitudData ?? [],
    [tiposSolicitudData]
  );
  const mantenimientoTipoOperacionId = useMemo(() => {
    const mantenimiento = tiposOperacionData?.find(
      (tipo) =>
        tipo?.codigo?.toLowerCase().includes("mantenimiento") ||
        tipo?.nombre?.toLowerCase().includes("mantenimiento")
    );
    return mantenimiento?.id;
  }, [tiposOperacionData]);
  const oportunidadFilter = useMemo(
    () => ({
      tipo_operacion_id: mantenimientoTipoOperacionId ?? -1,
    }),
    [mantenimientoTipoOperacionId]
  );

  const articuloFilter = useMemo(() => {
    const rawFilter = getArticuloFilterByTipo(
      tipoSolicitudValue ? String(tipoSolicitudValue) : undefined,
      tiposSolicitudCatalog
    );
    const normalized = rawFilter?.trim();
    return normalized ? normalized : undefined;
  }, [tipoSolicitudValue, tiposSolicitudCatalog]);

  // Filtros dinámicos para referencias del schema
  const dynamicReferenceFilters = useMemo(() => {
    if (!articuloFilter) return {};
    return {
      articulo_id: {
        tipo_articulo: articuloFilter,
      },
    };
  }, [articuloFilter]);

  // Determinar si el tipo de solicitud debe estar bloqueado
  const tipoSolicitudBloqueado = useMemo(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    return detalles.length > 0;
  }, [detallesValue]);

  useEffect(() => {
    const currentTipo = tipoSolicitudValue
      ? String(tipoSolicitudValue)
      : undefined;

    if (!currentTipo || tiposSolicitudCatalog.length === 0) {
      tipoSolicitudPreviousRef.current = currentTipo;
      return;
    }

    const defaultDepartamento = getDepartamentoDefaultByTipo(
      currentTipo,
      tiposSolicitudCatalog
    );
    const previousTipo = tipoSolicitudPreviousRef.current;
    const isCreate = !idValue;
    const tipoChanged = Boolean(previousTipo) && previousTipo !== currentTipo;

    if (defaultDepartamento && (isCreate || tipoChanged)) {
      const currentDepartamento = form.getValues("departamento_id");
      const normalizedDepartamento = currentDepartamento?.toString();
      if (normalizedDepartamento !== defaultDepartamento) {
        const departamentoIdValue = Number(defaultDepartamento);
        if (!Number.isNaN(departamentoIdValue)) {
          form.setValue("departamento_id", departamentoIdValue, {
            shouldDirty: true,
          });
        }
      }
    }

    tipoSolicitudPreviousRef.current = currentTipo;
  }, [form, idValue, tipoSolicitudValue, tiposSolicitudCatalog]);

  useEffect(() => {
    const detalles = Array.isArray(detallesValue) ? detallesValue : [];
    const calculated = detalles.reduce((acc, detalle) => {
      if (!detalle) return acc;
      const importe =
        typeof detalle.importe === "number"
          ? detalle.importe
          : (Number(detalle.cantidad) || 0) * (Number(detalle.precio) || 0);
      if (!Number.isFinite(importe)) {
        return acc;
      }
      return acc + Number(importe);
    }, 0);
    const normalizedTotal = Number(calculated.toFixed(2));
    const currentTotal = Number(form.getValues("total") ?? 0);
    if (!Number.isNaN(normalizedTotal) && Number(currentTotal.toFixed(2)) !== normalizedTotal) {
      form.setValue("total", normalizedTotal, {
        shouldDirty: true,
      });
    }
  }, [detallesValue, form]);

  useAutoInitializeField("solicitante_id", "id", !idValue);

  const generalSubtitle = useMemo(
    () =>
      buildGeneralSubtitle(
        idValue,
        estadoValue,
        comentarioValue,
        GENERAL_SUBTITLE_COMMENT_SNIPPET
      ),
    [idValue, estadoValue, comentarioValue]
  );

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Cabecera",
          subtitle: generalSubtitle,
          defaultOpen: !idValue,
          headerContent: <PoSolicitudHeaderInline />,
          headerContentPosition: "inline",
          contentPadding: "none",
          contentClassName: "space-y-2 px-4 py-2",
          children: (
            <FormSimpleSection>
              <DatosGeneralesContent 
                oportunidadFilter={oportunidadFilter} 
                tipoSolicitudBloqueado={tipoSolicitudBloqueado}
              />
            </FormSimpleSection>
          ),
        },
        {
          id: "imputacion",
          title: "Imputación",
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <ImputacionContent oportunidadFilter={oportunidadFilter} />
            </FormSimpleSection>
          ),
        },
        {
          id: "articulos",
          title: "Detalle",
          defaultOpen: true,
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
              <PoSolicitudDetalleContent articuloFilter={articuloFilter} />
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};

const PoSolicitudTotalInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  const total = useWatch({ control, name: "total" }) ?? 0;
  const formattedTotal = useMemo(
    () => CURRENCY_FORMATTER.format(Number(total) || 0),
    [total]
  );

  return (
    <div className="flex w-full items-center justify-end gap-2 text-[11px] leading-none text-muted-foreground">
      <span className="uppercase tracking-wider">Total estimado</span>
      <span className="font-semibold text-primary">{formattedTotal}</span>
    </div>
  );
};

const PoSolicitudHeaderInline = () => {
  const { control } = useFormContext<PoSolicitud>();
  const estadoValue = useWatch({ control, name: "estado" });
  if (!estadoValue) {
    return null;
  }
  const estadoKey = String(estadoValue);
  const estadoLabel =
    ESTADO_CHOICES.find((choice) => choice.id === estadoKey)?.name ||
    estadoKey;
  const badgeClass = ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800";
  return (
    <div className="flex w-full items-center justify-end">
      <Badge className={badgeClass}>{estadoLabel}</Badge>
    </div>
  );
};

const FormFooter = () => (
  <FormToolbar />
);

export const PoSolicitudForm = () => {
  const location = useLocation();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => poSolicitudCabeceraSchema.defaults(),
    []
  );
  const oportunidadIdFromLocation = useMemo(() => {
    const state = location.state as
      | { oportunidad_id?: number | string; filter?: Record<string, unknown> }
      | null;
    if (state?.oportunidad_id != null) {
      return Number(state.oportunidad_id);
    }
    const stateFilter = state?.filter;
    if (stateFilter?.oportunidad_id != null) {
      return Number(stateFilter.oportunidad_id);
    }
    return undefined;
  }, [location.state]);
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
    <SimpleForm defaultValues={defaultValues} toolbar={<FormFooter />}>
      <PoSolicitudFormFields />
    </SimpleForm>
  );
};








