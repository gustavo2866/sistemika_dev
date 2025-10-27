"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { useDataProvider } from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { DetailEditorFooter } from "@/components/form/detail-editor";
import { createFormDefaults } from "@/components/form/helpers/detailHelpers";

import {
  SolicitudDetalleSchema,
  type DetalleEditorValues,
  type SolicitudFormValues,
  truncateDescripcion,
} from "../model";
import { SolicitudFormDetailsEdit } from "./FormDetailsEdit";

type SolicitudFormDetailsProps = {
  shouldOpenEditor?: boolean;
  onEditorOpened?: () => void;
  setIsDetailEditorOpen?: (open: boolean) => void;
  setFooterContent?: (content: ReactNode) => void;
};

type ArticuloOption = { id: number; nombre: string };

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; index: number };

export const SolicitudFormDetails = ({
  shouldOpenEditor,
  onEditorOpened,
  setIsDetailEditorOpen,
  setFooterContent,
}: SolicitudFormDetailsProps) => {
  const buildEmptyDetalle = useCallback(
    () => createFormDefaults(SolicitudDetalleSchema) as DetalleEditorValues,
    [],
  );

  const parentForm = useFormContext<SolicitudFormValues>();
  const dataProvider = useDataProvider();
  const { append, update, remove } = useFieldArray({
    control: parentForm.control,
    name: "detalles",
  });
  const detalles = parentForm.watch("detalles") ?? [];
  const detallesActuales = Array.isArray(detalles)
    ? (detalles as DetalleEditorValues[])
    : [];

  const detalleForm = useForm<DetalleEditorValues>({
    defaultValues: buildEmptyDetalle(),
  });

  const [articulos, setArticulos] = useState<ArticuloOption[]>([]);

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
        if (active) setArticulos([]);
      });

    return () => {
      active = false;
    };
  }, [dataProvider]);

  const articulosMap = useMemo(
    () => new Map(articulos.map((item) => [item.id, item.nombre])),
    [articulos],
  );

  const [editorState, setEditorState] = useState<EditorState | null>(null);

  const openCreate = useCallback(() => {
    detalleForm.reset(buildEmptyDetalle());
    setEditorState({ mode: "create" });
  }, [buildEmptyDetalle, detalleForm]);

  useEffect(() => {
    if (shouldOpenEditor) {
      openCreate();
      onEditorOpened?.();
    }
  }, [shouldOpenEditor, openCreate, onEditorOpened]);

  const openEdit = (index: number) => {
    const current = detallesActuales[index];
    detalleForm.reset({
      id: current?.id ?? "",
      articulo_id: current?.articulo_id ?? "",
      descripcion: current?.descripcion ?? "",
      unidad_medida: current?.unidad_medida ?? "",
      cantidad: current?.cantidad ?? "",
    });
    setEditorState({ mode: "edit", index });
  };

  const closeEditor = useCallback(() => {
    setEditorState(null);
    detalleForm.reset(buildEmptyDetalle());
  }, [buildEmptyDetalle, detalleForm]);

  const handleDetalleSubmit = useCallback(
    (values: DetalleEditorValues) => {
      const payload: DetalleEditorValues = {
        id: values.id?.trim() ?? "",
        articulo_id: values.articulo_id.trim(),
        descripcion: values.descripcion.trim(),
        unidad_medida: values.unidad_medida.trim(),
        cantidad: values.cantidad.trim() || "0",
      };

      const wasCreateMode = editorState?.mode === "create";

      if (editorState?.mode === "edit" && editorState.index != null) {
        update(editorState.index, payload);
        closeEditor();
      } else {
        append(payload);

        if (wasCreateMode) {
          setTimeout(() => {
            openCreate();
          }, 0);
        } else {
          closeEditor();
        }
      }
    },
    [append, closeEditor, editorState, openCreate, update],
  );

  const submitDetalle = useCallback(() => {
    void detalleForm.handleSubmit(handleDetalleSubmit)();
  }, [detalleForm, handleDetalleSubmit]);

  const handleDelete = useCallback(() => {
    if (editorState?.mode === "edit" && editorState.index != null) {
      remove(editorState.index);
      closeEditor();
    }
  }, [editorState, remove, closeEditor]);

  const isEditing = editorState !== null;

  const detailCards = (
    <div className="max-h-[460px] overflow-y-auto space-y-3 pr-1">
      {detallesActuales.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aun no se agregaron articulos.
        </p>
      ) : (
        detallesActuales.map((detalle, index) => {
          const articuloIdCrudo = detalle?.articulo_id;
          const articuloIdTexto =
            typeof articuloIdCrudo === "string"
              ? articuloIdCrudo.trim()
              : articuloIdCrudo != null
                ? String(articuloIdCrudo).trim()
                : "";
          const articuloNombre =
            articuloIdTexto.length > 0 ? articulosMap.get(Number(articuloIdTexto)) : undefined;

          const nombre = articuloNombre || detalle?.descripcion || `Detalle ${index + 1}`;

          return (
            <button
              type="button"
              key={
                detalle.id && detalle.id.length > 0
                  ? `detalle-${detalle.id}`
                  : `detalle-${index}`
              }
              onClick={() => openEdit(index)}
              className="w-full rounded-lg border bg-card px-4 py-3 shadow-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-between gap-3"
            >
              <div className="min-w-0 text-left">
                <p className="font-medium truncate">{nombre}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {truncateDescripcion(detalle?.descripcion)}
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

  useEffect(() => {
    if (isEditing) {
      setIsDetailEditorOpen?.(true);
      if (setFooterContent) {
        setFooterContent(
          <DetailEditorFooter
            onClose={closeEditor}
            onSubmit={submitDetalle}
            onDelete={editorState?.mode === "edit" ? handleDelete : undefined}
            showDelete={false}
            showClose={false}
          />,
        );
      }
    } else {
      setIsDetailEditorOpen?.(false);
      setFooterContent?.(null);
    }
  }, [
    isEditing,
    editorState,
    closeEditor,
    handleDelete,
    submitDetalle,
    setIsDetailEditorOpen,
    setFooterContent,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Detalle de Articulos</h3>
        <Button type="button" size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      {isEditing ? (
        <SolicitudFormDetailsEdit
          detalleForm={detalleForm}
          articulos={articulos}
          isEditMode={editorState.mode === "edit"}
          onSubmit={submitDetalle}
          onClose={closeEditor}
          onDelete={editorState.mode === "edit" ? handleDelete : undefined}
          showInlineActions={!setFooterContent}
        />
      ) : (
        detailCards
      )}
    </div>
  );
};
