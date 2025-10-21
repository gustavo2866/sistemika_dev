"use client";

import { useEffect, useMemo, useState } from "react";
import { required } from "ra-core";
import {
  useForm,
  useFormContext,
  useFieldArray,
  Controller,
  type Control,
} from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  RaRecord,
  useDataProvider,
  useRecordContext,
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
  unidad_medida: "",
  cantidad: "",
};

export const SolicitudMbForm = (
  { isEdit = false }: { isEdit?: boolean },
) => (
  <SimpleForm className="w-full max-w-5xl space-y-6" defaultValues={{ detalles: [] }}>
    <SolicitudMbFormFields isEdit={isEdit} />
  </SimpleForm>
);

const SolicitudMbFormFields = ({ isEdit }: { isEdit: boolean }) => {
  const record = useRecordContext<SolicitudMbRecord>();
  const form = useFormContext<SolicitudMbFormValues>();
  const dataProvider = useDataProvider();
  const [detailsLoaded, setDetailsLoaded] = useState(!isEdit);
  const [generalOpen, setGeneralOpen] = useState(true);

  const recordId = record?.id;

  useEffect(() => {
    if (!isEdit) {
      if (!form.getValues("tipo")) {
        form.setValue("tipo", "normal", { shouldDirty: false });
      }
      if (!Array.isArray(form.getValues("detalles"))) {
        form.setValue("detalles", [], { shouldDirty: false });
      }
      return;
    }

    if (record?.version != null) {
      form.setValue("version", record.version, { shouldDirty: false });
    }

    if (detailsLoaded) {
      return;
    }

    if (record?.detalles && record.detalles.length > 0) {
      form.setValue("detalles", mapDetalleRecords(record.detalles), {
        shouldDirty: false,
      });
      setDetailsLoaded(true);
      return;
    }

    if (!recordId) {
      return;
    }

    let active = true;
    dataProvider
      .getList("solicitud-detalles", {
        filter: { solicitud_id: recordId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "id", order: "ASC" },
      })
      .then(({ data }) => {
        if (!active) return;
        form.setValue("detalles", mapDetalleRecords(data), {
          shouldDirty: false,
        });
        setDetailsLoaded(true);
      })
      .catch(() => {
        if (active) {
          setDetailsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [dataProvider, detailsLoaded, form, isEdit, record, recordId]);

  return (
    <div className="space-y-6 pb-36">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Informacion General</h3>
            <p className="text-sm text-muted-foreground">
              Datos principales de la solicitud
            </p>
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
        {generalOpen ? (
          <div className="space-y-4">
            <Separator />
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
          </div>
        ) : null}
      </Card>

      <SolicitudMbDetalles detailsLoaded={detailsLoaded} />
    </div>
  );
};

const SolicitudMbDetalles = ({ detailsLoaded }: { detailsLoaded: boolean }) => {
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

  const openCreate = () => {
    detalleForm.reset(emptyDetalle);
    setEditorState({ mode: "create" });
  };

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

    if (editorState?.mode === "edit" && editorState.index != null) {
      update(editorState.index, payload);
    } else {
      append(payload);
    }

    closeEditor();
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
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center gap-2">
          {editorState.mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={submitDetalle}
            className="text-primary"
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1">
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
                <SelectTrigger>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldControl
            control={detalleForm.control}
            name="cantidad"
            label="Cantidad"
            type="number"
            placeholder="0"
            min="0"
            step="0.001"
          />
          <FieldControl
            control={detalleForm.control}
            name="unidad_medida"
            label="Unidad de Medida"
            placeholder="Ej: UN"
          />
        </div>

        <FieldTextArea
          control={detalleForm.control}
          name="descripcion"
          label="Descripcion"
          placeholder="Describe la necesidad"
          rows={4}
          required
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Detalle de Articulos</h3>
            <p className="text-sm text-muted-foreground">
              Gestiona las lineas de detalle de la solicitud
            </p>
          </div>
        </div>

        {detailPlaceholder(detailsLoaded)}

        {isEditing ? detailEditor : detailCards}
      </div>

      <Button
        type="button"
        size="icon"
        onClick={openCreate}
        className="fixed bottom-20 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full shadow-lg z-30"
      >
        <Plus className="h-7 w-7" />
      </Button>
    </div>
  );
};

const detailPlaceholder = (detailsLoaded: boolean) => {
  if (!detailsLoaded) {
    return (
      <p className="text-sm text-muted-foreground">Cargando detalles...</p>
    );
  }
  return null;
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
  }:
    {
      control: Control<DetalleEditorValues>;
      name: keyof DetalleEditorValues;
      label: string;
      type?: string;
      placeholder?: string;
      min?: string;
      step?: string;
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
          value={field.value ?? ""}
          onChange={field.onChange}
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
