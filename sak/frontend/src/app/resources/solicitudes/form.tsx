"use client";

import { useMemo } from "react";
import { required } from "ra-core";
import { useFormContext, useWatch, useForm } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  CollapsibleSection,
  FormDialog,
  FormField,
  AddItemButton,
  DetailList,
  MinItemsValidation,
  useReferenceOptions,
  useAutoInitializeField,
  useDetailCRUD,
} from "@/components/forms";

const tipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

type DetalleFormValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
};

const detalleDefaultValues: DetalleFormValues = {
  articulo_id: "",
  descripcion: "",
  unidad_medida: "UN",
  cantidad: 1,
};

type SolicitudDetalle = {
  id?: number;
  tempId?: number;
  articulo_id: number | null;
  articulo_nombre?: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
};

const DetalleItemsSection = ({
  minItems = 0,
  onNewItemCreated,
}: {
  minItems?: number;
  onNewItemCreated?: () => void;
}) => {
  // Crear el form para el detalle
  const detalleForm = useForm<DetalleFormValues>({
    defaultValues: detalleDefaultValues,
  });

  // Usar el hook genérico para toda la lógica CRUD
  const {
    fields,
    sortedEntries,
    dialogOpen,
    setDialogOpen,
    editingIndex,
    setEditingIndex,
    handleAdd,
    handleDelete,
    handleSubmit,
    handleCancel,
  } = useDetailCRUD<DetalleFormValues, SolicitudDetalle>({
    fieldName: "detalles",
    detalleForm,
    defaultValues: detalleDefaultValues,
  });

  // Usar el hook genérico para cargar opciones
  const { options: articuloOptions, loading: articulosLoading } =
    useReferenceOptions("articulos", "nombre");

  // Custom edit handler para convertir number a string (específico de este form)
  const handleEditItem = (index: number) => {
    const detalle = fields[index] as SolicitudDetalle;
    detalleForm.reset({
      articulo_id: detalle.articulo_id != null ? String(detalle.articulo_id) : "",
      descripcion: detalle.descripcion,
      unidad_medida: detalle.unidad_medida,
      cantidad: detalle.cantidad,
    });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  // Custom submit handler con validación (específico de este form)
  const handleSubmitDetalle = detalleForm.handleSubmit((data: DetalleFormValues) => {
    detalleForm.clearErrors();

    const validationErrors: Partial<Record<keyof DetalleFormValues, string>> = {};

    if (!data.articulo_id) {
      validationErrors.articulo_id = "Selecciona un articulo";
    }
    if (!data.descripcion.trim()) {
      validationErrors.descripcion = "La descripcion es requerida";
    }
    if (!data.unidad_medida.trim()) {
      validationErrors.unidad_medida = "La unidad de medida es requerida";
    }
    if (!Number.isFinite(data.cantidad) || data.cantidad <= 0) {
      validationErrors.cantidad = "La cantidad debe ser mayor a 0";
    }

    if (Object.keys(validationErrors).length > 0) {
      Object.entries(validationErrors).forEach(([field, message]) => {
        detalleForm.setError(field as keyof DetalleFormValues, {
          type: "manual",
          message,
        });
      });
      return;
    }

    const selectedArticulo = articuloOptions.find(
      (option: { id: number; nombre: string }) => String(option.id) === data.articulo_id
    );
    const normalized: SolicitudDetalle = {
      articulo_id: selectedArticulo ? selectedArticulo.id : null,
      articulo_nombre: selectedArticulo?.nombre ?? "",
      descripcion: data.descripcion.trim(),
      unidad_medida: data.unidad_medida.trim(),
      cantidad: data.cantidad,
    };

    // Usar handleSubmit genérico
    handleSubmit(normalized, onNewItemCreated);
  });

  // Función para renderizar cada item
  const renderDetailItem = (item: SolicitudDetalle) => {
    const articuloLabel =
      item.articulo_nombre ||
      articuloOptions.find((option: { id: number; nombre: string }) => option.id === item.articulo_id)?.nombre ||
      "Sin articulo";

    return (
      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
          <Badge
            variant="secondary"
            className="max-w-full truncate px-2 py-1 text-sm font-semibold"
          >
            {articuloLabel}
          </Badge>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.unidad_medida || "-"}
          </span>
          <Badge variant="outline" className="px-2 py-1 text-sm font-semibold">
            {item.cantidad}
          </Badge>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.descripcion || "Articulo sin descripcion"}
        </div>
      </div>
    );
  };

  return (
    <CollapsibleSection title="Articulos seleccionados" defaultOpen>
      <AddItemButton
        onClick={() => {
          handleAdd();
          setDialogOpen(true);
        }}
        label="Agregar articulo"
      />

      <DetailList<SolicitudDetalle>
        items={sortedEntries.map((entry) => entry.item as SolicitudDetalle)}
        renderItem={renderDetailItem}
        onEdit={(_, index) => {
          const originalIndex = sortedEntries[index].originalIndex;
          handleEditItem(originalIndex);
        }}
        onDelete={(_, index) => {
          const originalIndex = sortedEntries[index].originalIndex;
          handleDelete(originalIndex);
        }}
        emptyMessage='Todavía no agregaste artículos. Presiona "Agregar articulo" para comenzar.'
        keyExtractor={(item) => String(item.id ?? item.tempId)}
      />

      <MinItemsValidation
        currentCount={fields.length}
        minItems={minItems}
        itemName="articulo"
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancel();
          }
          setDialogOpen(open);
        }}
        title={editingIndex == null ? "Agregar articulo" : "Editar articulo"}
        description="Completa los datos del articulo para la solicitud."
        onSubmit={handleSubmitDetalle}
        onCancel={handleCancel}
        submitLabel={editingIndex == null ? "Agregar" : "Actualizar"}
      >
        <FormField
          label="Articulo"
          error={detalleForm.formState.errors.articulo_id?.message}
          required
        >
          <Combobox
            value={detalleForm.watch("articulo_id")}
            onChange={(newValue: string) =>
              detalleForm.setValue("articulo_id", newValue, { shouldValidate: true })
            }
            options={articuloOptions}
            loading={articulosLoading}
            placeholder="Selecciona un articulo"
            searchPlaceholder="Buscar articulo..."
            loadingMessage="Cargando articulos..."
            emptyMessage="Sin resultados."
          />
        </FormField>

        <FormField
          label="Descripcion"
          error={detalleForm.formState.errors.descripcion?.message}
          required
        >
          <Textarea rows={3} {...detalleForm.register("descripcion")} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Unidad de medida"
            error={detalleForm.formState.errors.unidad_medida?.message}
            required
          >
            <Input
              placeholder="Ej: UN, KG, LT"
              {...detalleForm.register("unidad_medida")}
            />
          </FormField>
          
          <FormField
            label="Cantidad"
            error={detalleForm.formState.errors.cantidad?.message}
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
      </FormDialog>
    </CollapsibleSection>
  );
};

const SolicitudFormFields = () => {
  const form = useFormContext();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const tipoValue = useWatch({ control, name: "tipo" });
  const comentarioValue = useWatch({ control, name: "comentario" }) || "";

  // Auto-inicializar solicitante con el usuario actual
  useAutoInitializeField("solicitante_id", "id", !idValue);

  const generalSubtitle = useMemo(() => {
    const snippet = comentarioValue ? comentarioValue.slice(0, 25) : "";
    return [idValue, tipoValue, snippet].filter(Boolean).join(" - ") || "Sin datos";
  }, [idValue, tipoValue, comentarioValue]);

  return (
    <>
      <CollapsibleSection
        title="Datos generales"
        subtitle={generalSubtitle}
        defaultOpen={!idValue}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectInput
            source="tipo"
            label="Tipo de solicitud"
            choices={tipoChoices}
            className="w-full"
            validate={required()}
          />
          <TextInput
            source="fecha_necesidad"
            label="Fecha de necesidad"
            type="date"
            validate={required()}
            className="w-full"
          />
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
          <TextInput
            source="comentario"
            label="Comentarios"
            multiline
            rows={3}
            className="md:col-span-2"
          />
        </div>
        
      </CollapsibleSection>

      <DetalleItemsSection
        minItems={1}
        onNewItemCreated={() => {
          // Se puede cerrar la sección de datos generales si se desea
        }}
      />
    </>
  );
};

export const Form = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <SimpleForm
      defaultValues={{
        tipo: "normal",
        fecha_necesidad: today,
        solicitante_id: undefined,
        comentario: "",
        detalles: [] as SolicitudDetalle[],
      }}
    >
    <SolicitudFormFields />
    </SimpleForm>
  );
};
