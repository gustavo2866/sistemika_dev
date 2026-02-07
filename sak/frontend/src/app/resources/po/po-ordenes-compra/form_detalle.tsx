/**
 * Componentes de DETALLE para Ordenes de Compra.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider } from "ra-core";
import { type UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactNumberInput,
  FormDetailCardCompact,
  FormDetailCardList,
  FormDetailFormDialog,
  FormDetailSectionMinItems,
  LineDeleteButton,
  useFormDetailSectionContext,
} from "@/components/forms";
import { CompactRadixSelect } from "@/components/forms";
import {
  HeaderSummaryDisplay,
  useArticuloWatcher,
  StandardFormGrid,
  createTwoColumnSection,
} from "@/components/generic";
import { ImputacionDetailSection } from "../shared/imputacion-detail";
import {
  type PoOrdenCompraDetalle,
  calculateLineaTotal,
  formatImporteDisplay,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
} from "./model";
import { TEXT_LIMITS, truncateText } from "./transformers";

export type DetalleFormValues = {
  articulo_id: string;
  solicitud_detalle_id: string;
  oportunidad_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  total_linea: number;
  centro_costo_id: string;
};

interface PoOrdenCompraDetalleFormProps {
  articuloFilterId?: number;
  imputacionDefaults?: {
    centro_costo_id?: number | null;
    oportunidad_id?: number | null;
  };
}

type PoOrdenCompraDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilterId?: number;
  imputacionDefaults?: {
    centro_costo_id?: number | null;
    oportunidad_id?: number | null;
  };
};

export const PoOrdenCompraDetalleCard = ({
  item,
  onDelete,
  imputacionDefaults,
}: {
  item: PoOrdenCompraDetalle;
  onDelete: () => void;
  imputacionDefaults?: {
    centro_costo_id?: number | null;
    oportunidad_id?: number | null;
  };
}) => {
  const dataProvider = useDataProvider();
  const { getReferenceLabel } = useFormDetalle();
  const {
    articuloTitle,
    descripcion,
    descripcionTruncada,
    showVerMas,
    summaryFields,
  } = buildDetalleCardView(item, getReferenceLabel);
  const solicitudDetalleId = item.solicitud_detalle_id ?? null;
  const [solicitudLabel, setSolicitudLabel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!solicitudDetalleId) {
      setSolicitudLabel(null);
      return () => {
        mounted = false;
      };
    }

    dataProvider
      .getOne("po-solicitud-detalles", { id: solicitudDetalleId })
      .then(({ data }) => {
        if (!mounted) return;
        const solicitudId = Number((data as any)?.solicitud_id);
        if (!Number.isFinite(solicitudId) || solicitudId <= 0) {
          setSolicitudLabel(null);
          return;
        }
        dataProvider
          .getOne("po-solicitudes", { id: solicitudId })
          .then(({ data: solicitud }) => {
            if (!mounted) return;
            const titulo = (solicitud as any)?.titulo;
            setSolicitudLabel(
              titulo ? `#${solicitudId} - ${titulo}` : `#${solicitudId}`
            );
          })
          .catch(() => {
            if (!mounted) return;
            setSolicitudLabel(`#${solicitudId}`);
          });
      })
      .catch(() => {
        if (!mounted) return;
        setSolicitudLabel(null);
      });

    return () => {
      mounted = false;
    };
  }, [dataProvider, solicitudDetalleId]);
  const itemCentro = item.centro_costo_id ?? null;
  const itemOportunidad = item.oportunidad_id ?? null;
  const headerCentro = imputacionDefaults?.centro_costo_id ?? null;
  const headerOportunidad = imputacionDefaults?.oportunidad_id ?? null;

  const itemImputacionLabel = itemOportunidad
    ? `Oportunidad: ${getReferenceLabel("oportunidad_id", itemOportunidad) ?? `#${itemOportunidad}`}`
    : itemCentro
      ? `Centro costo: ${getReferenceLabel("centro_costo_id", itemCentro) ?? `#${itemCentro}`}`
      : "";

  const isSameAsHeader =
    (itemOportunidad && headerOportunidad && String(itemOportunidad) === String(headerOportunidad)) ||
    (itemCentro && headerCentro && String(itemCentro) === String(headerCentro));
  const shouldShowImputacion = Boolean(itemImputacionLabel) && !isSameAsHeader;

  return (
    <div>
      <FormDetailCardCompact
        title={
          <div className="flex w-full items-center gap-2">
            <span className="text-[12px] font-semibold sm:text-[13px]">
              {articuloTitle}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <HeaderSummaryDisplay
                fields={summaryFields}
                separator=" "
                layout="inline"
                className="text-[9px] text-muted-foreground sm:text-[10px]"
              />
            </div>
          </div>
        }
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {descripcion ? (
              <>
                <span className="text-[9px] text-muted-foreground sm:text-[10px]">
                  {descripcionTruncada}
                </span>
                {showVerMas ? (
                  <span className="ml-1 text-[9px] underline sm:text-[10px]">
                    ver mas
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-[9px] text-muted-foreground sm:text-[10px]">
                Articulo sin descripcion
              </span>
            )}
            {solicitudLabel ? (
              <div className="mt-0.5 text-[7px] text-muted-foreground sm:text-[8px]">
                Solicitud: {solicitudLabel}
              </div>
            ) : null}
          </div>
          <LineDeleteButton
            className="ml-auto"
            onClick={() => onDelete()}
          />
        </div>
        {shouldShowImputacion ? (
          <div className="mt-1 text-[8px] text-muted-foreground">
            <span className="font-medium">Imputacion:</span> {itemImputacionLabel}
          </div>
        ) : null}
      </FormDetailCardCompact>
    </div>
  );
};

const buildDetalleCardView = (
  item: PoOrdenCompraDetalle,
  getReferenceLabel: (
    fieldName: string,
    value: number | string | null | undefined
  ) => string | undefined
) => {
  const articuloLabel =
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;
  const articuloTitle = truncateText(articuloLabel, TEXT_LIMITS.ARTICLE_NAME);
  const descripcion = (item.descripcion || "").trim();
  const descripcionTruncada = truncateText(descripcion, TEXT_LIMITS.DESCRIPTION);
  const showVerMas = descripcion.length > descripcionTruncada.length;
  const totalValue =
    typeof item.total_linea === "number"
      ? item.total_linea
      : calculateLineaTotal(
          Number(item.cantidad ?? 0),
          Number(item.precio_unitario ?? 0)
        );

  const precioDisplay = formatImporteDisplay(Number(item.precio_unitario ?? 0));
  const totalDisplay = formatImporteDisplay(Number(totalValue ?? 0));

  const summaryFields = [
    {
      value: `Cant ${item.cantidad ?? "-"}`,
      formatter: "text" as const,
      className: "font-semibold text-foreground",
    },
    {
      value: `Precio: ${precioDisplay}`,
      formatter: "text" as const,
    },
    {
      value: `= ${totalDisplay}`,
      formatter: "text" as const,
    },
  ];

  return {
    articuloTitle,
    descripcion,
    descripcionTruncada,
    showVerMas,
    summaryFields,
  };
};

export const PoOrdenCompraDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
  imputacionDefaults,
}: PoOrdenCompraDetalleDialogContentProps) => {
  const dataProvider = useDataProvider();
  const { resolveAction, dialogOpen } = useFormDetailSectionContext<
    DetalleFormValues,
    PoOrdenCompraDetalle
  >();
  const { getReferenceLabel } = useFormDetailSectionContext();
  const { data: articulo } = useArticuloWatcher("articulo_id");
  const isGenerico = Boolean(
    (articulo as { generico?: boolean } | undefined)?.generico
  );

  const cantidadValue = detalleForm.watch("cantidad");
  const precioValue = detalleForm.watch("precio_unitario");
  const subtotalValue = detalleForm.watch("subtotal");
  const totalValue = detalleForm.watch("total_linea");

  const totalDisplay = useMemo(() => {
    return formatImporteDisplay(Number(totalValue ?? 0));
  }, [totalValue]);

  const canApplyDefaults = useMemo(
    () => resolveAction() === "create",
    [resolveAction]
  );
  const imputacionResetKey = useMemo(
    () => `${resolveAction()}-${dialogOpen ? "open" : "closed"}`,
    [resolveAction, dialogOpen]
  );

  useEffect(() => {
    const cantidad = Number(cantidadValue ?? 0) || 0;
    const precio = Number(precioValue ?? 0) || 0;
    const calculated = calculateLineaTotal(cantidad, precio);
    const currentSubtotal = Number(subtotalValue ?? Number.NaN);
    const currentTotal = Number(totalValue ?? Number.NaN);

    if (!Number.isNaN(calculated) && Number.isFinite(calculated)) {
      if (calculated !== currentSubtotal) {
        detalleForm.setValue("subtotal", calculated, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (calculated !== currentTotal) {
        detalleForm.setValue("total_linea", calculated, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [cantidadValue, precioValue, subtotalValue, totalValue, detalleForm]);

  useEffect(() => {
    if (!isGenerico) {
      detalleForm.clearErrors("descripcion");
    }
  }, [detalleForm, isGenerico]);

  const descripcionRegister = detalleForm.register("descripcion", {
    validate: (value) => {
      if (!isGenerico) return true;
      return String(value ?? "").trim().length > 0 || "La descripcion es requerida";
    },
  });

  const articuloField = (
    <CompactFormField
      label="Articulo"
      error={detalleForm.formState.errors.articulo_id}
      required
    >
      <CompactComboboxQuery
        {...ARTICULOS_REFERENCE}
        value={detalleForm.watch("articulo_id")}
        onChange={(value: string) =>
          detalleForm.setValue("articulo_id", value, { shouldValidate: true })
        }
        placeholder="Selecciona un articulo"
        filter={articuloFilterQuery}
        dependsOn="all"
      />
    </CompactFormField>
  );

  const descripcionField = (
    <CompactFormField
      label="Descripcion"
      error={detalleForm.formState.errors.descripcion}
      required={isGenerico}
    >
      <>
        <Textarea
          rows={3}
          className="min-h-9 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
          {...descripcionRegister}
        />
        {isGenerico ? (
          <p className="text-[9px] text-muted-foreground sm:text-[10px]">
            Requerido para articulos genericos
          </p>
        ) : null}
      </>
    </CompactFormField>
  );

  const solicitudIdValue = detalleForm.watch("solicitud_detalle_id");
  const [solicitudLabel, setSolicitudLabel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!solicitudIdValue) {
      setSolicitudLabel(null);
      return () => {
        mounted = false;
      };
    }

    dataProvider
      .getOne("po-solicitud-detalles", { id: solicitudIdValue })
      .then(({ data }) => {
        if (!mounted) return;
        const solicitudId = Number((data as any)?.solicitud_id);
        if (!Number.isFinite(solicitudId) || solicitudId <= 0) {
          setSolicitudLabel(null);
          return;
        }
        dataProvider
          .getOne("po-solicitudes", { id: solicitudId })
          .then(({ data: solicitud }) => {
            if (!mounted) return;
            const titulo = (solicitud as any)?.titulo;
            setSolicitudLabel(
              titulo ? `#${solicitudId} - ${titulo}` : `#${solicitudId}`
            );
          })
          .catch(() => {
            if (!mounted) return;
            setSolicitudLabel(`#${solicitudId}`);
          });
      })
      .catch(() => {
        if (!mounted) return;
        setSolicitudLabel(null);
      });

    return () => {
      mounted = false;
    };
  }, [dataProvider, solicitudIdValue]);
  const solicitudInfo = (
    <div className="text-[9px] text-muted-foreground sm:text-[10px]">
      Solicitud: {solicitudLabel ?? "-"}
    </div>
  );

  const formSections = [
    {
      columns: 1 as const,
      fields: [
        { component: articuloField },
        { component: descripcionField },
        { component: solicitudInfo },
      ],
    },
    {
      columns: 1 as const,
      fields: [
        {
          component: (
            <div className="grid grid-cols-[minmax(0,80px)_minmax(0,80px)_minmax(0,110px)] items-start gap-2">
              <CompactFormField
                key="cantidad"
                label="Cantidad"
                error={detalleForm.formState.errors.cantidad}
                required
              >
                <CompactNumberInput
                  source="cantidad"
                  label={false}
                  step={0.01}
                  min={0}
                  required
                />
              </CompactFormField>
              <CompactRadixSelect
                label="Unidad"
                choices={UNIDAD_MEDIDA_CHOICES}
                value={detalleForm.watch("unidad_medida") ?? ""}
                onChange={(value) =>
                  detalleForm.setValue("unidad_medida", value, {
                    shouldValidate: true,
                  })
                }
                placeholder="Unidad"
                error={detalleForm.formState.errors.unidad_medida}
                required
              />
              <CompactFormField
                key="precio"
                label="Precio"
                error={detalleForm.formState.errors.precio_unitario}
                required
              >
                <CompactNumberInput
                  source="precio_unitario"
                  label={false}
                  step={0.01}
                  min={0}
                  required
                />
              </CompactFormField>
            </div>
          ),
        },
      ],
    },
    {
      columns: 2 as const,
      fields: [
        {
          span: 2,
          component: (
            <div className="w-full">
              <CompactFormField
                label="Total"
                error={detalleForm.formState.errors.total_linea}
              >
                <>
                  <Input
                    type="text"
                    value={totalDisplay}
                    readOnly
                    className="h-7 w-full bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                  <input
                    type="hidden"
                    {...detalleForm.register("total_linea", {
                      valueAsNumber: true,
                    })}
                  />
                  <input
                    type="hidden"
                    {...detalleForm.register("subtotal", { valueAsNumber: true })}
                  />
                  <ImputacionDetailSection
                    form={detalleForm}
                    centroCostoReference={CENTROS_COSTO_REFERENCE}
                    oportunidadReference={OPORTUNIDADES_REFERENCE}
                    imputacionDefaults={imputacionDefaults}
                    getReferenceLabel={getReferenceLabel}
                    applyDefaults={canApplyDefaults}
                    resetKey={imputacionResetKey}
                  />
                </>
              </CompactFormField>
            </div>
          ),
        },
      ],
    },
  ];

  return (
    <StandardFormGrid sections={formSections} responsive className="space-y-4" />
  );
};

export const PoOrdenCompraDetalleForm = ({
  articuloFilterId,
  imputacionDefaults,
}: PoOrdenCompraDetalleFormProps) => {
  const articuloFilterQuery = useMemo(
    () => (articuloFilterId ? { tipo_articulo_id: articuloFilterId } : undefined),
    [articuloFilterId]
  );

  return (
    <FormDetailFormDialog
      title={({ action }) =>
        action === "create" ? "Agregar articulo" : "Editar articulo"
      }
      description="Completa los datos del articulo para la orden."
    >
      {(detalleForm) => (
        <PoOrdenCompraDetalleDialogContent
          detalleForm={detalleForm as unknown as UseFormReturn<DetalleFormValues>}
          articuloFilterQuery={articuloFilterQuery}
          imputacionDefaults={imputacionDefaults}
        />
      )}
    </FormDetailFormDialog>
  );
};

export const PoOrdenCompraDetalleContent = ({
  articuloFilterId,
  imputacionDefaults,
}: {
  articuloFilterId?: number;
  imputacionDefaults?: {
    centro_costo_id?: number | null;
    oportunidad_id?: number | null;
  };
}) => {
  const { handleDeleteBySortedIndex } = useFormDetalle();

  return (
    <>
      <div className="border-b border-border/60 -mt-4 pb-0 pt-0" />

      <FormDetailCardList<PoOrdenCompraDetalle>
        emptyMessage="Todavia no agregaste articulos."
        emptyStateClassName="border-dashed"
        emptyStateContentClassName="flex flex-col items-center justify-center py-4 text-center"
        emptyStateIconClassName="mb-2 h-6 w-6 text-muted-foreground/50"
        emptyStateTextClassName="text-[10px] text-muted-foreground sm:text-xs"
        showEditAction={false}
        showDeleteAction={false}
        contentClassName="px-2 py-2 sm:px-3"
        gridClassName="grid-cols-[minmax(0,1fr)] items-start gap-2"
        listClassName="mt-1 space-y-1"
        variant="row"
      >
        {(item, index) => (
          <PoOrdenCompraDetalleCard
            item={item}
            imputacionDefaults={imputacionDefaults}
            onDelete={() => handleDeleteBySortedIndex(index)}
          />
        )}
      </FormDetailCardList>

      <FormDetailSectionMinItems itemName="articulo" />
      <PoOrdenCompraDetalleForm
        articuloFilterId={articuloFilterId}
        imputacionDefaults={imputacionDefaults}
      />
    </>
  );
};

const useFormDetalle = () => useFormDetailSectionContext();
