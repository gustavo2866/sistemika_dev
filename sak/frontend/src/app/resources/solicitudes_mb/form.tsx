"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { required, useRecordContext, useGetIdentity } from "ra-core";
import {
  useForm,
  useFormContext,
  useFieldArray,
  Controller,
  useWatch,
  type Control,
} from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { Card } from "@/components/ui/card";
import {
  RaRecord,
  useDataProvider,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  SolicitudMbDetalleFormValue,
  SolicitudMbFormValues,
} from "./types";

export const solicitudMbTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

type SolicitudMbRecord = RaRecord & {
  version?: number;
  detalles?: SolicitudMbDetalleFormValue[];
};

type DetalleEditorValues = {
  articulo_id: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: string;
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; index: number; existingId?: number };

const emptyDetalle: DetalleEditorValues = {
  articulo_id: "",
  descripcion: "",
  unidad_medida: "UN",
  cantidad: "",
};

export const SolicitudMbForm = () => {
  return (
    <SimpleForm
      className="w-full max-w-5xl space-y-6"
      defaultValues={(record?: SolicitudMbRecord) => ({
        tipo: record?.tipo ?? "normal",
        fecha_necesidad: record?.fecha_necesidad ?? "",
        comentario: record?.comentario ?? "",
        solicitante_id: record?.solicitante_id ?? undefined,
        version: record?.version,
        detalles: mapDetalleRecords(record?.detalles ?? []),
      })}
    >
      <SolicitudMbFormFields />
    </SimpleForm>
  );
};

const SolicitudMbFormFields = () => {
  const router = useRouter();
  const record = useRecordContext<SolicitudMbRecord>();
  const { data: identity } = useGetIdentity();
  const isEditMode = !!(record && record.id);
  const isCreateMode = !isEditMode;
  const [generalOpen, setGeneralOpen] = useState(!isEditMode); // Cerrado en modo edición
  const form = useFormContext();
  
  // Watch form values para el resumen
  const tipo = useWatch({ name: "tipo" });
  const comentario = useWatch({ name: "comentario" });
  const fechaNecesidad = useWatch({ name: "fecha_necesidad" });
  
  // Establecer defaults cuando estamos en modo crear y tenemos la identidad
  useEffect(() => {
    if (isCreateMode && identity?.id) {
      const currentValues = form.getValues();
      const getCurrentDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
      };
      
      // Solo establecer valores si no están ya establecidos
      if (!currentValues.fecha_necesidad) {
        form.setValue("fecha_necesidad", getCurrentDate());
      }
      if (!currentValues.solicitante_id) {
        form.setValue("solicitante_id", identity.id);
      }
      if (!currentValues.tipo) {
        form.setValue("tipo", "normal");
      }
    }
  }, [isCreateMode, identity, form]);
  
  // Generar resumen dinámico
  const generateSummary = () => {
    const tipoText = tipo === "directa" ? "Compra Directa" : "Normal";
    const comentarioTruncated = comentario ? 
      (comentario.length > 50 ? comentario.substring(0, 50) + "..." : comentario) : 
      "Sin comentario";
    const fechaText = fechaNecesidad || "Sin fecha";
    
    return `${tipoText} • ${comentarioTruncated} • ${fechaText}`;
  };
  
  // Estado para controlar cuándo abrir el editor
  const [shouldOpenEditor, setShouldOpenEditor] = useState(false);

  // Función para aceptar y colapsar
  const handleAccept = () => {
    // Agregar un detalle vacío si no existe
    const currentDetalles = form.getValues("detalles") || [];
    if (currentDetalles.length === 0) {
      form.setValue("detalles", [{
        id: undefined,
        articulo_id: undefined,
        descripcion: "",
        unidad_medida: "",
        cantidad: 0,
      }]);
    }
    setGeneralOpen(false);
    // Activar la apertura del editor después de un momento para que el colapso se complete
    setTimeout(() => setShouldOpenEditor(true), 100);
  };

  // Cerrar el formulario automáticamente al guardar exitosamente
  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      router.back();
    }
  }, [form.formState.isSubmitSuccessful, router]);

  return (
    <div className="space-y-6 pb-36">
      <Card className="overflow-hidden">
        <div className="p-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                Informacion General
                {record?.id && (
                  <span className="text-lg font-semibold text-muted-foreground align-middle">ID: {record.id}</span>
                )}
              </h3>
              {!generalOpen && (
                <p className="text-sm text-muted-foreground mt-1">
                  {generateSummary()}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGeneralOpen((open) => !open)}
              className="gap-2"
            >
              <span className="hidden sm:inline">
                {generalOpen ? "Ocultar" : "Mostrar"}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${generalOpen ? "" : "-rotate-90"}`}
              />
            </Button>
          </div>
        </div>
        {generalOpen && (
          <div className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                source="tipo"
                label="Tipo"
                choices={solicitudMbTipoChoices}
                className="w-full"
              />
              <TextInput
                source="fecha_necesidad"
                label="Fecha de Necesidad"
                type="date"
                validate={required()}
                className="w-full"
              />
            </div>
            <ReferenceInput
              source="solicitante_id"
              reference="users"
              label="Solicitante"
            >
              <SelectInput optionText="nombre" className="w-full" validate={required()} />
            </ReferenceInput>
            <TextInput
              source="comentario"
              label="Comentario"
              multiline
              rows={3}
              className="w-full"
            />
            
            {/* Botón Aceptar solo en modo crear */}
            {isCreateMode && (
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleAccept}
                  className="px-6"
                >
                  Aceptar
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <SolicitudMbDetalles 
        shouldOpenEditor={shouldOpenEditor} 
        onEditorOpened={() => setShouldOpenEditor(false)} 
      />
    </div>
  );
};

const SolicitudMbDetalles = ({ 
  shouldOpenEditor, 
  onEditorOpened 
}: { 
  shouldOpenEditor?: boolean;
  onEditorOpened?: () => void;
}) => {
  const parentForm = useFormContext<SolicitudMbFormValues>();
  const dataProvider = useDataProvider();
  const { append, update, remove } = useFieldArray({
    control: parentForm.control,
    name: "detalles",
  });
  const detalles = parentForm.watch("detalles") ?? [];

  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const detalleForm = useForm<DetalleEditorValues>({
    defaultValues: emptyDetalle,
  });

  const [articulos, setArticulos] = useState<Array<{ id: number; nombre: string }>>([]);

  useEffect(() => {
    let active = true;
    dataProvider
      .getList("articulos", {
        filter: {},
        pagination: { page: 1, perPage: 200 },
        sort: { field: "nombre", order: "ASC" },
      })
      .then(({ data }) => {
        if (!active) return;
        const mapped = (data as Array<Record<string, unknown>>).map((item) => ({
          id: Number(item.id),
          nombre:
            (typeof item.nombre === "string" && item.nombre) ||
            (typeof item.descripcion === "string" && item.descripcion) ||
            `Articulo ${item.id}`,
        }));
        setArticulos(mapped);
      })
      .catch(() => {
        if (active) {
          setArticulos([]);
        }
      });

    return () => {
      active = false;
    };
  }, [dataProvider]);

  const articulosMap = useMemo(
    () => new Map(articulos.map((item) => [item.id, item.nombre])),
    [articulos],
  );

  const openCreate = useCallback(() => {
    detalleForm.reset({
      articulo_id: "",
      descripcion: "",
      unidad_medida: "UN",
      cantidad: "",
    });
    setEditorState({ mode: "create" });
  }, [detalleForm]);

  // Efecto para abrir el editor cuando se activa desde el botón Aceptar
  useEffect(() => {
    if (shouldOpenEditor) {
      openCreate();
      onEditorOpened?.();
    }
  }, [shouldOpenEditor, openCreate, onEditorOpened]);

  const openEdit = (index: number) => {
    const current = detalles[index];
    detalleForm.reset({
      articulo_id: current?.articulo_id != null ? String(current.articulo_id) : "",
      descripcion: current?.descripcion ?? "",
      unidad_medida: current?.unidad_medida ?? "",
      cantidad:
        typeof current?.cantidad === "number"
          ? String(current.cantidad)
          : current?.cantidad != null
            ? String(current.cantidad)
            : "",
    });
    setEditorState({ mode: "edit", index, existingId: current?.id });
  };

  const closeEditor = () => {
    setEditorState(null);
    detalleForm.reset(emptyDetalle);
  };

  const submitDetalle = detalleForm.handleSubmit((values) => {
    const payload: SolicitudMbDetalleFormValue = {
      id: editorState && "existingId" in editorState ? editorState.existingId : undefined,
      articulo_id:
        values.articulo_id && values.articulo_id.trim().length > 0
          ? Number(values.articulo_id)
          : null,
      descripcion: values.descripcion.trim(),
      unidad_medida: values.unidad_medida.trim() || null,
      cantidad:
        values.cantidad && values.cantidad.trim().length > 0
          ? Number(values.cantidad)
          : 0,
    };

    const wasCreateMode = editorState?.mode === "create";

    if (editorState?.mode === "edit" && editorState.index != null) {
      update(editorState.index, payload);
      closeEditor();
    } else {
      append(payload);
      
      // En modo create, agregar una nueva línea vacía y reabrir el editor
      if (wasCreateMode) {
        // Usar setTimeout para asegurar que el estado se actualice correctamente
        setTimeout(() => {
          openCreate();
        }, 0);
      } else {
        closeEditor();
      }
    }
  });

  const handleDelete = () => {
    if (editorState?.mode === "edit" && editorState.index != null) {
      remove(editorState.index);
      closeEditor();
    }
  };

  const isEditing = editorState !== null;

  const detailCards = (
    <div className="max-h-[340px] overflow-y-auto space-y-3 pr-1">
      {detalles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aun no se agregaron articulos.
        </p>
      ) : (
        detalles.map((detalle, index) => {
          const nombre =
            (detalle?.articulo_id != null && articulosMap.get(detalle.articulo_id)) ||
            detalle?.descripcion ||
            `Detalle ${index + 1}`;

          return (
            <button
              type="button"
              key={detalle.id ?? `detalle-${index}`}
              onClick={() => openEdit(index)}
              className="w-full rounded-lg border bg-card px-4 py-3 shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-between gap-3"
            >
              <div className="min-w-0 text-left">
                <p className="font-medium truncate">{nombre}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {detalle?.descripcion || "Sin descripcion"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {detalle?.unidad_medida ? (
                  <Badge variant="outline">UM: {detalle.unidad_medida}</Badge>
                ) : null}
                <Badge variant="secondary">Cant: {detalle?.cantidad ?? 0}</Badge>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  const detailEditor = editorState ? (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      {editorState.mode === "edit" ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      ) : null}

      <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1">
        {/* Campos principales - responsive */}
        <div className="space-y-4">
          {/* Artículo - siempre en fila completa */}
          <Controller
            control={detalleForm.control}
            name="articulo_id"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="articulo_id">Articulo</Label>
                <Select
                  value={field.value && field.value.length > 0 ? field.value : "__none__"}
                  onValueChange={(value) =>
                    field.onChange(value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full md:max-w-[50ch]">
                    <SelectValue placeholder="Seleccionar articulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {articulos.map((articulo) => (
                      <SelectItem key={articulo.id} value={String(articulo.id)}>
                        {articulo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          
          {/* Unidad de Medida y Cantidad - responsive */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-[8ch_10ch] md:gap-3">
            <FieldControl
              control={detalleForm.control}
              name="unidad_medida"
              label="Uni Med"
              placeholder="UN"
              maxLength={3}
              className="w-full"
            />
            
            <FieldControl
              control={detalleForm.control}
              name="cantidad"
              label="Cantidad"
              type="number"
              placeholder="0"
              min="0"
              step="0.001"
              className="w-full"
            />
          </div>
        </div>

        <FieldTextArea
          control={detalleForm.control}
          name="descripcion"
          label="Descripcion"
          placeholder="Describe la necesidad"
          rows={4}
          required
        />

        {/* Botones al final del formulario */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={closeEditor}
            className="gap-2 px-6"
            tabIndex={-1}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <Button
            type="button"
            onClick={submitDetalle}
            className="gap-2 px-6"
          >
            <Save className="h-4 w-4" />
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detalle de Articulos</h3>
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        </div>

        {isEditing ? detailEditor : detailCards}
      </div>
    </div>
  );
};
const FieldControl = (
  {
    control,
    name,
    label,
    type = "text",
    placeholder,
    min,
    step,
    maxLength,
    className,
  }:
    {
      control: Control<DetalleEditorValues>;
      name: keyof DetalleEditorValues;
      label: string;
      type?: string;
      placeholder?: string;
      min?: string;
      step?: string;
      maxLength?: number;
      className?: string;
    },
) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Input
          id={name}
          type={type}
          placeholder={placeholder}
          min={min}
          step={step}
          maxLength={maxLength}
          value={field.value ?? ""}
          onChange={field.onChange}
          className={className}
        />
      </div>
    )}
  />
);

const FieldTextArea = (
  {
    control,
    name,
    label,
    placeholder,
    rows = 3,
    required,
  }:
    {
      control: Control<DetalleEditorValues>;
      name: keyof DetalleEditorValues;
      label: string;
      placeholder?: string;
      rows?: number;
      required?: boolean;
    },
) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="space-y-2">
        <Label htmlFor={name}>{label}</Label>
        <Textarea
          id={name}
          rows={rows}
          placeholder={placeholder}
          value={field.value ?? ""}
          onChange={field.onChange}
          required={required}
        />
      </div>
    )}
  />
);

const mapDetalleRecords = (detalles: SolicitudMbDetalleFormValue[] = []) =>
  detalles.map((detalle) => ({
    id: detalle.id,
    articulo_id: detalle.articulo_id ?? undefined,
    descripcion: detalle.descripcion ?? "",
    unidad_medida: detalle.unidad_medida ?? "",
    cantidad: detalle.cantidad ?? 0,
  }));
