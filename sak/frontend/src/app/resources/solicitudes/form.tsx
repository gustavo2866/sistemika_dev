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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComboboxQuery,
  FormLayout,
  FormDialog,
  FormField,
  AddItemButton,
  DetailList,
  MinItemsValidation,
  useAutoInitializeField,
  useDetailCRUD,
} from "@/components/forms";
import {
  type DetalleFormValues,
  type SolicitudDetalle,
  TIPO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  DETALLE_DEFAULT_VALUES,
  ARTICULOS_REFERENCE,
  validateDetalle,
  transformToForm,
  transformToPersist,
  buildGeneralSubtitle,
} from "./model";

const DetalleItemsSection = ({
  minItems = 0,
  onNewItemCreated,
}: {
  minItems?: number;
  onNewItemCreated?: () => void;
}) => {
  // Crear el form para el detalle
  const detalleForm = useForm<DetalleFormValues>({
    defaultValues: DETALLE_DEFAULT_VALUES,
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
    defaultValues: DETALLE_DEFAULT_VALUES,
  });

  // Custom edit handler usando la transformación del modelo
  const handleEditItem = (index: number) => {
    const detalle = fields[index] as SolicitudDetalle;
    detalleForm.reset(transformToForm(detalle));
    setEditingIndex(index);
    setDialogOpen(true);
  };

  // Custom submit handler usando validación y normalización del modelo
  const handleSubmitDetalle = detalleForm.handleSubmit((data: DetalleFormValues) => {
    detalleForm.clearErrors();

    // Validar usando la función del modelo
    const hasErrors = validateDetalle(data, detalleForm);
    if (hasErrors) {
      return;
    }

    // Normalizar usando la función del modelo
    // Nota: ComboboxQuery ya carga las opciones internamente con caché
    const normalized = transformToPersist(data, []);

    // Usar handleSubmit genérico
    handleSubmit(normalized, onNewItemCreated);
  });

  // Render function para cada item
  const renderItem = (item: SolicitudDetalle) => {
    // Nota: articulo_nombre ya viene en el objeto desde transformToPersist
    const articuloLabel = item.articulo_nombre || `ID: ${item.articulo_id}`;

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
    <>
      <AddItemButton
        onClick={() => {
          handleAdd();
          setDialogOpen(true);
        }}
        label="Agregar articulo"
      />

      <DetailList<SolicitudDetalle>
        items={sortedEntries.map((entry) => entry.item as SolicitudDetalle)}
        renderItem={renderItem}
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
          <ComboboxQuery
            {...ARTICULOS_REFERENCE}
            value={detalleForm.watch("articulo_id")}
            onChange={(newValue: string) =>
              detalleForm.setValue("articulo_id", newValue, { shouldValidate: true })
            }
            placeholder="Selecciona un articulo"
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
            <Select
              value={detalleForm.watch("unidad_medida")}
              onValueChange={(value) =>
                detalleForm.setValue("unidad_medida", value, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona unidad" />
              </SelectTrigger>
              <SelectContent>
                {UNIDAD_MEDIDA_CHOICES.map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
    </>
  );
};

// Contenido de la sección de datos generales
const DatosGeneralesContent = () => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SelectInput
        source="tipo"
        label="Tipo de solicitud"
        choices={TIPO_CHOICES}
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

  // Calcular subtítulo usando helper del modelo
  const generalSubtitle = useMemo(
    () => buildGeneralSubtitle(idValue, tipoValue, comentarioValue),
    [idValue, tipoValue, comentarioValue]
  );

  return (
    <FormLayout
      spacing="md"
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: !idValue,
          children: <DatosGeneralesContent />,
        },
        {
          id: "articulos-seleccionados",
          title: "Articulos seleccionados",
          defaultOpen: true,
          children: <DetalleItemsSection minItems={1} />,
        },
      ]}
    />
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
