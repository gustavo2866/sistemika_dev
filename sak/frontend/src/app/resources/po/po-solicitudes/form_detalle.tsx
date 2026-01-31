/**
 * Componentes de DETALLE para PoSolicitudes (REFACTORIZADO)
 * 
 * Refactorizado para usar componentes genéricos reutilizables:
 * - HeaderSummaryDisplay para displays de información
 * - ReferenceFieldWatcher para manejo de referencias
 * - ConditionalFieldLock para bloqueo condicional
 * - StandardFormGrid para layouts declarativos
 */

"use client";

import { useEffect, useMemo } from "react";
import { type UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AddItemButton,
  CompactComboboxQuery,
  CompactFormField,
  FormDetailCardCompact,
  FormDetailCardList,
  FormDetailClearAllButton,
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
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  TEXT_LIMITS,
  truncateText,
  calculateImporte,
  formatImporteDisplay,
  VALIDATION_RULES,
} from "./model";
import {
  createDetailSchema,
  numberField,
  referenceField,
  selectField,
  stringField,
} from "@/lib/form-detail-schema";

// Tipos de detalle para formulario.
export type DetalleFormValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio: number;
  importe: number;
};

// Tipo para errores de validacion por campo.
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

// Valida un detalle y registra errores en el formulario.
export function validateDetalle(
  data: DetalleFormValues,
  form: UseFormReturn<DetalleFormValues>
): boolean {
  const errors: ValidationErrors<DetalleFormValues> = {};

  if (!data.articulo_id) {
    errors.articulo_id = "Selecciona un articulo";
  }

  if (
    data.descripcion &&
    data.descripcion.length > VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH
  ) {
    errors.descripcion = `Maximo ${VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH} caracteres`;
  }

  if (!data.unidad_medida.trim()) {
    errors.unidad_medida = "La unidad de medida es requerida";
  }

  if (
    !Number.isFinite(data.cantidad) ||
    data.cantidad <= VALIDATION_RULES.DETALLE.MIN_CANTIDAD
  ) {
    errors.cantidad = "La cantidad debe ser mayor a 0";
  }

  if (!Number.isFinite(data.precio) || data.precio < 0) {
    errors.precio = "El precio debe ser mayor o igual a 0";
  }

  if (Object.keys(errors).length > 0) {
    Object.entries(errors).forEach(([field, message]) => {
      form.setError(field as keyof DetalleFormValues, {
        type: "manual",
        message,
      });
    });
    return true;
  }

  return false;
}

// Esquema de formulario para detalles de PoSolicitud.
export const poSolicitudDetalleSchema = createDetailSchema<
  DetalleFormValues,
  PoSolicitudDetalle
>({
  fields: {
    articulo_id: referenceField({
      resource: ARTICULOS_REFERENCE.resource,
      labelField: ARTICULOS_REFERENCE.labelField,
      perPage: ARTICULOS_REFERENCE.limit,
      sortField: ARTICULOS_REFERENCE.labelField,
      sortOrder: "ASC",
      defaultValue: "",
    }),
    descripcion: stringField({
      required: false,
      trim: true,
      maxLength: VALIDATION_RULES.DETALLE.MAX_DESCRIPCION_LENGTH,
      defaultValue: "",
    }),
    unidad_medida: selectField({
      required: true,
      options: UNIDAD_MEDIDA_CHOICES,
      defaultValue: "UN",
    }),
    cantidad: numberField({
      required: true,
      min: VALIDATION_RULES.DETALLE.MIN_CANTIDAD + 1,
      defaultValue: 1,
    }),
    precio: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
    importe: numberField({
      required: true,
      min: 0,
      defaultValue: 0,
    }),
  },
});

// ============================================
// TYPES
// ============================================

interface PoSolicitudDetalleFormProps {
  articuloFilterId?: number;
}

type PoSolicitudDetalleDialogContentProps = {
  detalleForm: UseFormReturn<DetalleFormValues>;
  articuloFilterQuery?: Record<string, unknown>;
  articuloFilterId?: number;
};

// ============================================
// COMPONENTES DE DETALLE
// ============================================

/**
 * Tarjeta individual de un artículo/detalle (REFACTORIZADA)
 * Usa HeaderSummaryDisplay para mostrar información de manera consistente
 */
export const PoSolicitudDetalleCard = ({
  item,
  onDelete,
}: {
  item: PoSolicitudDetalle;
  onDelete: () => void;
}) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const articuloLabel =
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;
  const articuloTitle = truncateText(articuloLabel, TEXT_LIMITS.ARTICLE_NAME);
  const descripcion = (item.descripcion || "").trim();
  const descripcionTruncada = truncateText(descripcion, TEXT_LIMITS.DESCRIPTION);
  const showVerMas = descripcion.length > descripcionTruncada.length;

  // Usar HeaderSummaryDisplay para información de cantidad, precio e importe
  const summaryFields = [
    {
      value: `Cantidad ${item.cantidad ?? "-"} ${item.unidad_medida || "-"}`,
      formatter: 'text' as const,
    },
    {
      value: item.precio ?? 0,
      formatter: 'currency' as const,
      label: "Precio",
    },
    {
      value: typeof item.importe === "number"
        ? item.importe
        : (item.cantidad ?? 0) * (item.precio ?? 0),
      formatter: 'currency' as const,
      label: "Importe",
      className: "font-semibold text-foreground",
    },
  ];

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
        <HeaderSummaryDisplay
          fields={summaryFields}
          separator=" "
          layout="inline"
          className="text-[9px] text-muted-foreground sm:text-[10px]"
        />
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
  );
};

/**
 * Contenido del dialog para crear/editar un detalle (REFACTORIZADO)
 * Usa ReferenceFieldWatcher para manejo del artículo y StandardFormGrid para layout
 */
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
    createTwoColumnSection("", [
      <CompactFormField key="unidad" label="Unidad de medida" error={detalleForm.formState.errors.unidad_medida} required>
        <Select
          value={detalleForm.watch("unidad_medida") ?? ""}
          onValueChange={(value) => detalleForm.setValue("unidad_medida", value, { shouldValidate: true })}
        >
          <SelectTrigger className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm">
            <SelectValue placeholder="Selecciona unidad" />
          </SelectTrigger>
          <SelectContent>
            {UNIDAD_MEDIDA_CHOICES.map((choice) => (
              <SelectItem key={String(choice.id)} value={String(choice.id)}>
                {choice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CompactFormField>,
      <CompactFormField key="cantidad" label="Cantidad" error={detalleForm.formState.errors.cantidad} required>
        <Input
          type="number"
          step="0.01"
          min="0"
          className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          {...detalleForm.register("cantidad", { valueAsNumber: true })}
        />
      </CompactFormField>,
    ]),
    createTwoColumnSection("", [
      <CompactFormField key="precio" label="Precio unitario" error={detalleForm.formState.errors.precio} required>
        <Input
          type="number"
          step="0.01"
          min="0"
          className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          {...detalleForm.register("precio", { valueAsNumber: true, min: 0 })}
        />
      </CompactFormField>,
      <CompactFormField key="importe" label="Importe" error={detalleForm.formState.errors.importe}>
        <>
          <Input
            type="text"
            value={importeDisplay}
            readOnly
            className="h-7 bg-muted/50 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
          />
          <input type="hidden" {...detalleForm.register("importe", { valueAsNumber: true })} />
        </>
      </CompactFormField>,
    ]),
  ];

  return <StandardFormGrid sections={formSections} responsive={true} className="space-y-4" />;
};

/**
 * Formulario dialog para crear/editar detalles
 */
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

/**
 * Contenedor principal para la sección de detalles
 */
export const PoSolicitudDetalleContent = ({ articuloFilterId }: { articuloFilterId?: number }) => {
  const { handleStartCreate, handleDeleteBySortedIndex } = useFormDetailSectionContext();

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 -mt-4 pb-0 pt-0">
        <FormDetailClearAllButton
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
          confirmMessage="Seguro que deseas eliminar todos los articulos? Esto tambien desbloqueara el tipo de solicitud."
        />
        <AddItemButton
          label="Agregar articulo"
          onClick={handleStartCreate}
          className="h-6 gap-1 px-2 text-[10px] sm:h-7 sm:px-2.5 sm:text-[11px]"
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
      <PoSolicitudDetalleForm articuloFilterId={articuloFilterId} />
    </>
  );
};
