"use client";

import { useEffect, useMemo, useState } from "react";
import { required, useDataProvider } from "ra-core";
import { useForm, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";

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
  unidad_medida: "",
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

const useArticuloOptions = () => {
  const dataProvider = useDataProvider();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Array<{ id: number; nombre: string }>>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    dataProvider
      .getList("articulos", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "nombre", order: "ASC" },
        filter: {},
      })
      .then(({ data }) => {
        if (!mounted) return;
        setOptions(
          data.map((item: any) => ({
            id: item.id,
            nombre: item.nombre,
          }))
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [dataProvider]);

  return { options, loading };
};

const ArticuloCombobox = ({
  value,
  onChange,
  options,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: number; nombre: string }>;
  loading: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((option) => String(option.id) === value),
    [options, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          disabled={loading}
        >
          {selected
            ? selected.nombre
            : loading
              ? "Cargando articulos..."
              : "Selecciona un articulo"}
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Buscar articulo..." />
          <CommandList>
            {loading ? (
              <CommandEmpty>Cargando articulos...</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.nombre}
                      onSelect={() => {
                        onChange(String(option.id));
                        setOpen(false);
                      }}
                    >
                      {option.nombre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const DetalleItemsSection = ({
  open,
  onToggle,
  minItems = 0,
}: {
  open: boolean;
  onToggle: () => void;
  minItems?: number;
}) => {
  const { control } = useFormContext();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "detalles",
    keyName: "fieldId",
  });
  const { options: articuloOptions, loading: articulosLoading } = useArticuloOptions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const detalleForm = useForm<DetalleFormValues>({
    defaultValues: detalleDefaultValues,
  });

  const sortedEntries = useMemo(
    () =>
      fields
        .map((item, originalIndex) => ({ item: item as any, originalIndex }))
        .sort((a, b) => {
          const idA =
            (a.item as SolicitudDetalle).id ??
            (a.item as SolicitudDetalle).tempId ??
            0;
          const idB =
            (b.item as SolicitudDetalle).id ??
            (b.item as SolicitudDetalle).tempId ??
            0;
          return Number(idB) - Number(idA);
        }),
    [fields]
  );

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingIndex(null);
    detalleForm.reset(detalleDefaultValues);
  };

  const handleAddItem = () => {
    setEditingIndex(null);
    detalleForm.reset(detalleDefaultValues);
    setDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    const current = fields[index] as any;
    detalleForm.reset({
      articulo_id: current.articulo_id ? String(current.articulo_id) : "",
      descripcion: current.descripcion ?? "",
      unidad_medida: current.unidad_medida ?? "",
      cantidad: Number(current.cantidad ?? 1) || 1,
    });
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleSubmitDetalle = detalleForm.handleSubmit((data) => {
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
      (option) => String(option.id) === data.articulo_id
    );
    const normalized: SolicitudDetalle = {
      articulo_id: selectedArticulo ? selectedArticulo.id : null,
      articulo_nombre: selectedArticulo?.nombre ?? "",
      descripcion: data.descripcion.trim(),
      unidad_medida: data.unidad_medida.trim(),
      cantidad: data.cantidad,
    };

    if (editingIndex == null) {
      append(
        {
          ...normalized,
          tempId: Date.now(),
        },
        { shouldFocus: false }
      );
    } else {
      const existing = fields[editingIndex] as any;
      update(editingIndex, {
        ...existing,
        ...normalized,
        tempId: existing.tempId ?? Date.now(),
      });
    }
    closeDialog();
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 h-8 w-8"
            onClick={onToggle}
            aria-label={open ? "Colapsar articulos" : "Expandir articulos"}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </Button>
          <div>
            <h3 className="text-lg font-semibold">Articulos seleccionados</h3>
            <p className="text-sm text-muted-foreground">
              Gestiona los articulos asociados a la solicitud.
            </p>
          </div>
        </div>
        <Button type="button" onClick={handleAddItem} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Agregar articulo
        </Button>
      </div>

      <CardContent className={`space-y-4 ${open ? "block" : "hidden"} p-4`}>
        {sortedEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Todavia no agregaste articulos. Presiona "Agregar articulo" para comenzar.
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {sortedEntries.map(({ item, originalIndex }, renderedIndex) => {
              const detalle = item as SolicitudDetalle;
              const articuloLabel =
                detalle.articulo_nombre ||
                articuloOptions.find((option) => option.id === detalle.articulo_id)?.nombre ||
                "Sin articulo";

              return (
                <Card
                  key={detalle.id ?? detalle.tempId ?? `${originalIndex}-${renderedIndex}`}
                  className="border-border/70 transition-shadow hover:shadow-sm"
                >
                  <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-start justify-between gap-2 md:gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold leading-tight">
                          {detalle.descripcion || "Articulo sin descripcion"}
                        </span>
                        <Badge variant="secondary" className="w-fit">
                          {articuloLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          type="button"
                          onClick={() => handleEditItem(originalIndex)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          type="button"
                          onClick={() => remove(originalIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground md:justify-end">
                      <span className="uppercase tracking-wide">
                        Unidad: {detalle.unidad_medida || "-"}
                      </span>
                      <Badge variant="outline">{detalle.cantidad}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {minItems > 0 && fields.length < minItems && (
          <p className="text-sm text-red-500">
            Debes agregar al menos {minItems} articulo(s)
          </p>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIndex == null ? "Agregar articulo" : "Editar articulo"}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del articulo para la solicitud.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitDetalle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="detalle-articulo">Articulo</Label>
              <ArticuloCombobox
                value={detalleForm.watch("articulo_id")}
                onChange={(newValue) =>
                  detalleForm.setValue("articulo_id", newValue, { shouldValidate: true })
                }
                options={articuloOptions}
                loading={articulosLoading}
              />
              {detalleForm.formState.errors.articulo_id && (
                <p className="text-sm text-destructive">
                  {detalleForm.formState.errors.articulo_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="detalle-descripcion">Descripcion</Label>
              <Textarea
                id="detalle-descripcion"
                rows={3}
                {...detalleForm.register("descripcion")}
              />
              {detalleForm.formState.errors.descripcion && (
                <p className="text-sm text-destructive">
                  {detalleForm.formState.errors.descripcion.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="detalle-unidad">Unidad de medida</Label>
                <Input
                  id="detalle-unidad"
                  placeholder="Ej: UN, KG, LT"
                  {...detalleForm.register("unidad_medida")}
                />
                {detalleForm.formState.errors.unidad_medida && (
                  <p className="text-sm text-destructive">
                    {detalleForm.formState.errors.unidad_medida.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="detalle-cantidad">Cantidad</Label>
                <Input
                  id="detalle-cantidad"
                  type="number"
                  step="0.01"
                  min="0"
                  {...detalleForm.register("cantidad", { valueAsNumber: true })}
                />
                {detalleForm.formState.errors.cantidad && (
                  <p className="text-sm text-destructive">
                    {detalleForm.formState.errors.cantidad.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editingIndex == null ? "Agregar" : "Actualizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const SolicitudFormFields = () => {
  const { control } = useFormContext();
  const idValue = useWatch({ control, name: "id" });
  const tipoValue = useWatch({ control, name: "tipo" });
  const comentarioValue = useWatch({ control, name: "comentario" }) || "";

  const [generalOpen, setGeneralOpen] = useState(true);
  useEffect(() => {
    setGeneralOpen(!idValue);
  }, [idValue]);

  const [detailsOpen, setDetailsOpen] = useState(true);

  const generalSubtitle = useMemo(() => {
    const snippet = comentarioValue ? comentarioValue.slice(0, 25) : "";
    return [idValue, tipoValue, snippet].filter(Boolean).join(" - ") || "Sin datos";
  }, [idValue, tipoValue, comentarioValue]);

  

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-start gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-1 h-8 w-8"
              onClick={() => setGeneralOpen((prev) => !prev)}
              aria-label={generalOpen ? "Colapsar datos generales" : "Expandir datos generales"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${generalOpen ? "" : "-rotate-90"}`}
              />
            </Button>
            <div>
              <h3 className="text-lg font-semibold">Datos generales</h3>
              <p className="text-sm text-muted-foreground">{generalSubtitle}</p>
            </div>
          </div>
        </div>
        <CardContent className={`space-y-4 ${generalOpen ? "block" : "hidden"} p-4`}>
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
        </CardContent>
      </Card>

      <DetalleItemsSection
        open={detailsOpen}
        onToggle={() => setDetailsOpen((prev) => !prev)}
        minItems={1}
      />
    </>
  );
};

export const SolicitudForm = () => (
  <SimpleForm
    defaultValues={{
      tipo: "normal",
      fecha_necesidad: "",
      solicitante_id: undefined,
      comentario: "",
      detalles: [] as SolicitudDetalle[],
    }}
  >
    <SolicitudFormFields />
  </SimpleForm>
);
