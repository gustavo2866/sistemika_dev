/**
 * Componentes de DETALLE para PoSolicitudes.
 *
 * Estructura:
 * 1. TIPOS - Tipos del detalle y contratos internos
 * 2. HELPERS - Helpers de vista y normalizacion
 * 3. CARDS - Tarjetas y vistas de items
 * 4. DIALOG - Dialogo de edicion/alta
 * 5. CONTENEDOR - Seccion principal de detalle
 */


"use client";

import { useEffect, useMemo } from "react";
import { type UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactNumberInput,
  FormDetailCardCompact,
  FormDetailCardList,
  FormDetailFormDialog,
  FormDetailSectionMinItems,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HeaderSummaryDisplay,
  useArticuloWatcher,
  StandardFormGrid,
  createTwoColumnSection,
} from "@/components/generic";
import {
  type PoSolicitudDetalle,
  TEXT_LIMITS,
  truncateText,
  calculateImporte,
  formatImporteDisplay,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
} from "./model";

//*********************************
// region 1. TIPOS

// Tipos de detalle para formulario.
export type DetalleFormValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};
// endregion


//*********************************
// region 2. HELPERS

// Po SolicitudDetalleForm Props
interface PoSolicitudDetalleFormProps {
  articuloFilterId?: number;
}

// Props del dialog de detalle
type PoSolicitudDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilterId?: number;
};
// endregion

 
//*********************************
// region 3. CARDS

// Tarjeta individual para un detalle de PO
export const PoSolicitudDetalleCard = ({
  item,
  onDelete,
}: {
  item: PoSolicitudDetalle;
  onDelete: () => void;
}) => {
  const { getReferenceLabel } = useFormDetalle();
  const {
    articuloTitle,
    descripcion,
    descripcionTruncada,
    showVerMas,
    summaryFields,
  } = buildDetalleCardView(item, getReferenceLabel);

  return (
    <div className="relative">
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
      </FormDetailCardCompact>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-[-12px] top-1 h-[6px] w-[6px] rounded-full border border-muted/50 bg-background text-red-300 shadow-sm hover:bg-red-50 hover:text-red-400"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        aria-label="Eliminar"
      >
        <Trash2 className="h-[3px] w-[3px]" />
      </Button>
    </div>
  );
};

// Helper para construir la vista de tarjeta
const buildDetalleCardView = (
  item: PoSolicitudDetalle,
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
  const importeValue =
    typeof item.importe === "number"
      ? item.importe
      : calculateImporte(Number(item.cantidad ?? 0), Number(item.precio ?? 0));

  const precioDisplay = formatImporteDisplay(Number(item.precio ?? 0));
  const importeDisplay = formatImporteDisplay(Number(importeValue ?? 0));

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
      value: `= ${importeDisplay}`,
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
// endregion
};

 
//*********************************
// region 4. DIALOG

// Contenido del dialogo para crear/editar detalles
export const PoSolicitudDetalleDialogContent = ({
  detalleForm,
  articuloFilterQuery,
}: PoSolicitudDetalleDialogContentProps) => {
  // Usar el hook genérico para artículos
  const { data: articulo } = useArticuloWatcher("articulo_id");
  const isGenerico = Boolean((articulo as { generico?: boolean } | undefined)?.generico);
  
  const cantidadValue = detalleForm.watch("cantidad");
  const precioValue = detalleForm.watch("precio");
  const importeValue = detalleForm.watch("importe");

  const importeDisplay = useMemo(() => {
    return formatImporteDisplay(Number(importeValue ?? 0));
  }, [importeValue]);

  // Efecto para calcular importe automáticamente
  useEffect(() => {
    const cantidad = Number(cantidadValue ?? 0) || 0;
    const precio = Number(precioValue ?? 0) || 0;
    const calculated = calculateImporte(cantidad, precio);
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

  // Efecto para limpiar errores de descripción cuando no es genérico
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

  // Configurar las secciones del formulario de manera más compacta
  const articuloField = (
    <CompactFormField label="Artículo" error={detalleForm.formState.errors.articulo_id} required>
      <CompactComboboxQuery
        {...ARTICULOS_REFERENCE}
        value={detalleForm.watch("articulo_id")}
        onChange={(value: string) =>
          detalleForm.setValue("articulo_id", value, { shouldValidate: true })
        }
        placeholder="Selecciona un artículo"
        filter={articuloFilterQuery}
        dependsOn="all"
      />
    </CompactFormField>
  );

  const descripcionField = (
    <CompactFormField label="Descripción" error={detalleForm.formState.errors.descripcion} required={isGenerico}>
      <>
        <Textarea
          rows={3}
          className="min-h-9 px-2 py-1 text-[11px] sm:min-h-16 sm:px-3 sm:py-2 sm:text-sm"
          {...descripcionRegister}
        />
        {isGenerico ? (
          <p className="text-[9px] text-muted-foreground sm:text-[10px]">
            Requerido para artículos genéricos
          </p>
        ) : null}
      </>
    </CompactFormField>
  );

  const formSections = [
    { columns: 1 as const, fields: [{ component: articuloField }, { component: descripcionField }] },
    {
      columns: 1 as const,
      fields: [
        {
          component: (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,80px)_minmax(0,110px)] items-start gap-2">
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
              <CompactFormField
                key="unidad"
                label="Unidad"
                error={detalleForm.formState.errors.unidad_medida}
                required
              >
                <Select
                  value={detalleForm.watch("unidad_medida") ?? ""}
                  onValueChange={(value) =>
                    detalleForm.setValue("unidad_medida", value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm w-full">
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDAD_MEDIDA_CHOICES.map((choice) => (
                      <SelectItem key={String(choice.id)} value={String(choice.id)}>
                        {choice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CompactFormField>
              <CompactFormField
                key="precio"
                label="Precio"
                error={detalleForm.formState.errors.precio}
                required
              >
                <CompactNumberInput
                  source="precio"
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
    createTwoColumnSection("", [
      <div key="importe" className="max-w-[150px]">
        <CompactFormField label="Importe" error={detalleForm.formState.errors.importe}>
          <>
            <Input
              type="text"
              value={importeDisplay}
              readOnly
              className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
            />
            <input type="hidden" {...detalleForm.register("importe", { valueAsNumber: true })} />
          </>
        </CompactFormField>
      </div>,
    ]),
  ];

  return <StandardFormGrid sections={formSections} responsive={true} className="space-y-4" />;
};

// Formulario dialog para crear/editar detalles
export const PoSolicitudDetalleForm = ({ articuloFilterId }: PoSolicitudDetalleFormProps) => {
  const articuloFilterQuery = useMemo(
    () => (articuloFilterId ? { tipo_articulo_id: articuloFilterId } : undefined),
    [articuloFilterId]
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
        />
      )}
    </FormDetailFormDialog>
  );
};
// endregion

 
//*********************************
// region 5. CONTENEDOR

//  Contenido principal de la seccion de detalle
export const PoSolicitudDetalleContent = ({ articuloFilterId }: { articuloFilterId?: number }) => {
  const { handleDeleteBySortedIndex } = useFormDetalle();

  return (
    <>
      <div className="border-b border-border/60 -mt-4 pb-0 pt-0" />

      <FormDetailCardList<PoSolicitudDetalle>
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
          <PoSolicitudDetalleCard
            item={item}
            onDelete={() => handleDeleteBySortedIndex(index)}
          />
        )}
      </FormDetailCardList>
      
      <FormDetailSectionMinItems itemName="articulo" />
      <PoSolicitudDetalleForm articuloFilterId={articuloFilterId} />
    </>
  );
};

// Helper hook para usar el contexto de detalle
const useFormDetalle = () => useFormDetailSectionContext();

// endregion
