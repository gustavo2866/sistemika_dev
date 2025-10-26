"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import { useDataProvider } from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

import {
  DetalleEditorValues,
  EditorState,
  SolicitudFormValues,
  emptyDetalle,
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

export const SolicitudFormDetails = ({
  shouldOpenEditor,
  onEditorOpened,
  setIsDetailEditorOpen,
  setFooterContent,
}: SolicitudFormDetailsProps) => {
  const parentForm = useFormContext<SolicitudFormValues>();
  const dataProvider = useDataProvider();
  const { append, update, remove } = useFieldArray({
    control: parentForm.control,
    name: "detalles",
  });
  const detalles = parentForm.watch("detalles") ?? [];

  const detalleForm = useForm<DetalleEditorValues>({
    defaultValues: emptyDetalle,
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
    detalleForm.reset(emptyDetalle);
    setEditorState({ mode: "create" });
  }, [detalleForm]);

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

  const closeEditor = useCallback(() => {
    setEditorState(null);
    detalleForm.reset(emptyDetalle);
  }, [detalleForm]);

  const handleDetalleSubmit = useCallback(
    (values: DetalleEditorValues) => {
      const payload = {
        id:
          editorState && "existingId" in editorState
            ? editorState.existingId
            : undefined,
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
      {detalles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aun no se agregaron articulos.
        </p>
      ) : (
        detalles.map((detalle, index) => {
          const nombre =
            (detalle?.articulo_id != null &&
              articulosMap.get(
                typeof detalle.articulo_id === "number"
                  ? detalle.articulo_id
                  : Number(detalle.articulo_id),
              )) ||
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
        const footer = (
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
            <div className="flex gap-2">
              {editorState?.mode === "edit" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive gap-2"
                  tabIndex={-1}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
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
        );
        setFooterContent(footer);
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
