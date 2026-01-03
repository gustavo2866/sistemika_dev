"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { required, useDataProvider } from "ra-core";
import { useFormContext, useWatch, type UseFormReturn } from "react-hook-form";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ComboboxQuery,
  FormLayout,
  FormField,
  FormChoiceSelect,
  FormSimpleSection,
  FormDetailSection,
  FormDetailSectionAddButton,
  FormDetailCardList,
  FormDetailCard,
  FormDetailSectionMinItems,
  FormDetailFormDialog,
  useAutoInitializeField,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  type Solicitud,
  type SolicitudDetalle,
  type DetalleFormValues,
  ESTADO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PROVEEDORES_REFERENCE,
  VALIDATION_RULES,
  solicitudCabeceraSchema,
  solicitudDetalleSchema,
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

const buildGeneralSubtitle = (
  id: number | undefined,
  estado: string | undefined,
  comentario: string | undefined,
  comentarioSnippetLength: number = GENERAL_SUBTITLE_COMMENT_SNIPPET
): string => {
  const snippet = comentario ? comentario.slice(0, comentarioSnippetLength) : "";
  return [id, estado, snippet].filter(Boolean).join(" - ") || "Sin datos";
};

type TipoSolicitudCatalog = Pick<
  TipoSolicitud,
  "id" | "tipo_articulo_filter" | "departamento_default_id"
>;

const SolicitudDetalleCard = ({ item }: { item: SolicitudDetalle }) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const articuloLabel =
    item.articulo_nombre ||
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;

  return (
    <FormDetailCard
      title={articuloLabel}
      subtitle={item.descripcion || "Artículo sin descripción"}
      meta={[
        { label: "Unidad", value: item.unidad_medida || "-" },
        { label: "Cantidad", value: item.cantidad },
        { label: "Precio", value: CURRENCY_FORMATTER.format(Number(item.precio ?? 0)) },
        {
          label: "Importe",
          value: CURRENCY_FORMATTER.format(
            Number(
              typeof item.importe === "number"
                ? item.importe
                : (item.cantidad ?? 0) * (item.precio ?? 0)
            ) || 0
          ),
        },
      ]}
    />
  );
};

interface SolicitudDetalleFormProps {
  articuloFilter?: string;
}

type SolicitudDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilter?: string;
};

const SolicitudDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
  articuloFilter,
}: SolicitudDetalleDialogContentProps) => {
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

const SolicitudDetalleForm = ({ articuloFilter }: SolicitudDetalleFormProps) => {
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
        <SolicitudDetalleDialogContent
          detalleForm={detalleForm as unknown as UseFormReturn<DetalleFormValues>}
          articuloFilterQuery={articuloFilterQuery}
          articuloFilter={articuloFilter}
        />
      )}
    </FormDetailFormDialog>
  );
};

const SolicitudDetalleContent = ({ articuloFilter }: { articuloFilter?: string }) => (
  <>
    <FormDetailSectionAddButton label="Agregar artículo" />
    <FormDetailCardList<SolicitudDetalle>
      emptyMessage="Todavía no agregaste artículos."
    >
      {(item) => <SolicitudDetalleCard item={item} />}
    </FormDetailCardList>
    <FormDetailSectionMinItems itemName="artículo" />
    <SolicitudDetalleForm articuloFilter={articuloFilter} />
  </>
);

const DatosGeneralesContent = ({ oportunidadFilter }: { oportunidadFilter?: Record<string, unknown> }) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
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
        />
      </ReferenceInput>
    </div>
    
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

    <FormField label="Proveedor">
      <ComboboxQuery
        {...PROVEEDORES_REFERENCE}
        source="proveedor_id"
        placeholder="Selecciona un proveedor"
        className="w-full"
        clearable
      />
    </FormField>
    
    <div className="min-w-0">
      <SelectInput
        source="estado"
        label="Estado"
        choices={ESTADO_CHOICES}
        className="w-full"
        disabled
      />
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

const SolicitudFormFields = () => {
  const form = useFormContext<Solicitud>();
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
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: !idValue,
          children: (
            <FormSimpleSection>
              <DatosGeneralesContent oportunidadFilter={oportunidadFilter} />
            </FormSimpleSection>
          ),
        },
        {
          id: "articulos",
          title: "Artículos seleccionados",
          defaultOpen: true,
          children: (
            <FormDetailSection
              name="detalles"
              schema={solicitudDetalleSchema}
              minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
            >
              <SolicitudDetalleContent articuloFilter={articuloFilter} />
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};

const SolicitudTotals = () => {
  const { control } = useFormContext<Solicitud>();
  const total = useWatch({ control, name: "total" }) ?? 0;
  const formattedTotal = useMemo(
    () => CURRENCY_FORMATTER.format(Number(total) || 0),
    [total]
  );

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1 rounded-full bg-primary" aria-hidden="true" />
          <p className="text-[11px] font-medium uppercase leading-4 tracking-wider text-muted-foreground">
            Total estimado
          </p>
        </div>
        <p className="text-lg font-semibold text-primary sm:text-xl">{formattedTotal}</p>
      </div>
    </div>
  );
};

const FormFooter = () => (
  <div className="flex flex-col gap-4">
    <SolicitudTotals />
    <FormToolbar />
  </div>
);

export const Form = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => solicitudCabeceraSchema.defaults(),
    []
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
    return {
      ...cabeceraDefaults,
      fecha_necesidad: cabeceraDefaults.fecha_necesidad || today,
      solicitante_id: solicitanteDefault,
      centro_costo_id: centroCostoDefault,
      total: 0,
      detalles: [] as SolicitudDetalle[],
    };
  }, [cabeceraDefaults, today]);

  return (
    <SimpleForm defaultValues={defaultValues} toolbar={<FormFooter />}>
      <SolicitudFormFields />
    </SimpleForm>
  );
};


