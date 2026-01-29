"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useDataProvider, useGetIdentity, useGetOne } from "ra-core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid, ResponsableSelector } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { PO_SOLICITUDES_REFERENCE, PROVEEDORES_REFERENCE, TIPOS_SOLICITUD_REFERENCE, type PoOrdenCompraDetalle } from "./model";
import { CompactOportunidadSelector } from "../crm-oportunidades";
import type { PoSolicitudDetalle } from "../po-solicitudes/model";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const roundCurrency = (value: number) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

type WizardValues = {
  titulo: string;
  fecha: string;
  solicitudId: string;
  proveedorId: string;
  tipoSolicitudId: string;
  responsableId: string;
  oportunidadId: string;
};

export type CreateWizard2Payload = {
  titulo: string;
  fecha: string;
  solicitudId: number | null;
  proveedorId: number | null;
  tipoSolicitudId: number | null;
  responsableId: number | null;
  oportunidadId: number | null;
  detalles?: PoOrdenCompraDetalle[];
};

const normalizeId = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const CreateWizard2Component = ({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: CreateWizard2Payload) => void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  
  const { register, trigger, formState, getValues, reset, setValue, watch } =
    useForm<WizardValues>({
    defaultValues: {
      titulo: "",
      fecha: new Date().toISOString().slice(0, 10),
      solicitudId: "",
      proveedorId: "",
      tipoSolicitudId: "",
      responsableId: "",
      oportunidadId: "",
    }
  });
  const values = watch();
  const responsableFilterId = normalizeId(values.responsableId ?? "");
  const solicitudFilter = responsableFilterId
    ? { solicitante_id: responsableFilterId }
    : undefined;
  const solicitudId = normalizeId(values.solicitudId ?? "");
  const { data: solicitudData } = useGetOne(
    "po-solicitudes",
    { id: solicitudId ?? 0 },
    { enabled: solicitudId != null }
  );
  const solicitudDetalles = useMemo(
    () =>
      Array.isArray((solicitudData as any)?.detalles)
        ? ((solicitudData as any).detalles as PoSolicitudDetalle[])
        : [],
    [solicitudData]
  );
  const [editableDetalles, setEditableDetalles] = useState<PoSolicitudDetalle[]>([]);
  const articuloIds = useRef<number[]>([]);
  const [articulosMap, setArticulosMap] = useState<Map<number, string>>(
    () => new Map()
  );
  const proveedorId = normalizeId(values.proveedorId ?? "");
  const { data: proveedorData } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null }
  );
  const lastSolicitudAppliedRef = useRef<number | null>(null);
  const lastProveedorAppliedRef = useRef<number | null>(null);
  const identityId =
    identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;

  useEffect(() => {
    if (solicitudId == null) {
      return;
    }
    if (!solicitudDetalles.length) {
      setEditableDetalles([]);
      return;
    }
    setEditableDetalles(
      solicitudDetalles.map((detalle) => ({
        ...detalle,
        cantidad: normalizeNumber(detalle.cantidad ?? 0),
        precio: normalizeNumber(detalle.precio ?? 0),
        importe: normalizeNumber(detalle.importe ?? 0),
      }))
    );
  }, [solicitudDetalles, solicitudId]);

  useEffect(() => {
    if (solicitudId != null) return;
    const defaultArticuloId = Number((proveedorData as any)?.default_articulos_id ?? 0);
    if (!Number.isFinite(defaultArticuloId) || defaultArticuloId <= 0) {
      setEditableDetalles([]);
      return;
    }
    setEditableDetalles((prev) => {
      if (prev.length === 1 && Number(prev[0].articulo_id) === defaultArticuloId) {
        return prev;
      }
      return [
        {
          articulo_id: defaultArticuloId,
          descripcion: "",
          unidad_medida: "UN",
          cantidad: 1,
          precio: 0,
          importe: 0,
        } as PoSolicitudDetalle,
      ];
    });
  }, [proveedorData, solicitudId]);

  useEffect(() => {
    const nextIds = Array.from(
      new Set(
        editableDetalles
          .map((item) => Number(item.articulo_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
    articuloIds.current = nextIds;
  }, [editableDetalles]);

  useEffect(() => {
    let mounted = true;
    const nextIds = articuloIds.current;
    if (!nextIds.length) {
      if (articulosMap.size > 0) {
        setArticulosMap(new Map());
      }
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const { data } = await dataProvider.getList("articulos", {
          pagination: { page: 1, perPage: nextIds.length },
          sort: { field: "id", order: "ASC" },
          filter: { id: nextIds },
        });
        if (!mounted) return;
        const nextMap = new Map<number, string>();
        data.forEach((item: any) => {
          if (item?.id != null) {
            nextMap.set(Number(item.id), item.nombre ?? `ID ${item.id}`);
          }
        });
        setArticulosMap(nextMap);
      } catch {
        if (!mounted) return;
        setArticulosMap(new Map());
      }
    })();

    return () => {
      mounted = false;
    };
  }, [articulosMap.size, dataProvider, editableDetalles]);

  useEffect(() => {
    if (!identityId) return;
    if (values.responsableId) return;
    setValue("responsableId", String(identityId), { shouldDirty: false });
  }, [identityId, setValue, values.responsableId]);

  useEffect(() => {
    if (!solicitudData || solicitudId == null) return;
    if (lastSolicitudAppliedRef.current === solicitudId) return;
    lastSolicitudAppliedRef.current = solicitudId;
    const solicitud = solicitudData as {
      titulo?: string;
      tipo_solicitud_id?: number | null;
      proveedor_id?: number | null;
      fecha_necesidad?: string | null;
      oportunidad_id?: number | null;
    };
    if (solicitud.titulo) {
      setValue("titulo", solicitud.titulo, { shouldDirty: true });
    }
    if (solicitud.tipo_solicitud_id != null) {
      setValue("tipoSolicitudId", String(solicitud.tipo_solicitud_id), { shouldDirty: true });
    }
    if (solicitud.proveedor_id != null) {
      setValue("proveedorId", String(solicitud.proveedor_id), { shouldDirty: true });
    }
    if (solicitud.fecha_necesidad) {
      setValue("fecha", solicitud.fecha_necesidad.slice(0, 10), { shouldDirty: true });
    }
    if (solicitud.oportunidad_id != null) {
      setValue("oportunidadId", String(solicitud.oportunidad_id), { shouldDirty: true });
    }
  }, [solicitudData, solicitudId, setValue]);

  useEffect(() => {
    if (!proveedorData || proveedorId == null) return;
    if (lastProveedorAppliedRef.current === proveedorId) return;
    lastProveedorAppliedRef.current = proveedorId;
    const proveedor = proveedorData as { default_tipo_solicitud_id?: number | null };
    if (proveedor.default_tipo_solicitud_id != null) {
      setValue("tipoSolicitudId", String(proveedor.default_tipo_solicitud_id), {
        shouldDirty: true,
      });
    }
  }, [proveedorData, proveedorId, setValue]);

  const handleApply = async () => {
    const isValid = await trigger();
    if (isValid) {
      const values = getValues();
      const detallesPayload = editableDetalles.length
        ? editableDetalles.map((detalle) => {
              const cantidad = normalizeNumber(detalle.cantidad);
              const precio = normalizeNumber(detalle.precio);
              const subtotal = roundCurrency(cantidad * precio);
              return {
                articulo_id: detalle.articulo_id ?? null,
                po_solicitud_id: solicitudId ?? null,
                descripcion: detalle.descripcion ?? "",
                unidad_medida: detalle.unidad_medida ?? "UN",
                cantidad,
                precio_unitario: precio,
                subtotal,
                porcentaje_descuento: 0,
                importe_descuento: 0,
                porcentaje_iva: 0,
                importe_iva: 0,
                total_linea: subtotal,
              } as PoOrdenCompraDetalle;
            })
        : undefined;
      onApply({
        titulo: values.titulo,
        fecha: values.fecha,
        solicitudId: normalizeId(values.solicitudId),
        proveedorId: normalizeId(values.proveedorId),
        tipoSolicitudId: normalizeId(values.tipoSolicitudId),
        responsableId: normalizeId(values.responsableId),
        oportunidadId: normalizeId(values.oportunidadId),
        detalles: detallesPayload,
      });
      reset();
      setStep(1);
      onOpenChange(false);
    }
  };

  const handleNext = async () => {
    const isValid = await trigger(["titulo", "fecha", "proveedorId", "tipoSolicitudId"]);
    if (isValid) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCancel = () => {
    reset();
    setStep(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <span>Crear Orden de Compra</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          {step === 1 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cabecera
              </div>
              <div className="h-px w-full bg-muted/70" />
              <CompactFormGrid columns="two">
                <CompactFormField label="Responsable" required className="w-full">
                  <ResponsableSelector
                    includeTodos={false}
                    value={values.responsableId}
                    onValueChange={(value) =>
                      setValue("responsableId", value ?? "", { shouldDirty: true })
                    }
                    triggerClassName="w-full justify-between"
                  />
                </CompactFormField>
                <CompactFormField label="Solicitud">
                  <CompactComboboxQuery
                    {...PO_SOLICITUDES_REFERENCE}
                    value={values.solicitudId}
                    onChange={(value) =>
                      setValue("solicitudId", value, { shouldDirty: true })
                    }
                    placeholder="Selecciona solicitud"
                    clearable
                    className="h-8 w-full"
                    filter={solicitudFilter}
                    dependsOn={responsableFilterId ?? "all"}
                  />
                </CompactFormField>
              </CompactFormGrid>

              <CompactFormGrid columns="two">
                <CompactFormField label="Titulo" required error={formState.errors.titulo}>
                  <Input
                    id="titulo"
                    {...register("titulo", { required: "El titulo es obligatorio" })}
                    className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                </CompactFormField>
                <CompactFormField label="Fecha necesidad" required error={formState.errors.fecha}>
                  <Input
                    id="fecha"
                    type="date"
                    {...register("fecha", { required: "La fecha es obligatoria" })}
                    className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                </CompactFormField>
              </CompactFormGrid>

              <CompactFormGrid columns="two">
                <CompactFormField label="Proveedor" required error={formState.errors.proveedorId}>
                  <CompactComboboxQuery
                    {...PROVEEDORES_REFERENCE}
                    value={values.proveedorId}
                    onChange={(value) =>
                      setValue("proveedorId", value, { shouldDirty: true })
                    }
                    placeholder="Selecciona proveedor"
                    clearable
                    className="h-8 w-full"
                  />
                  <input
                    type="hidden"
                    {...register("proveedorId", { required: "El proveedor es obligatorio" })}
                  />
                </CompactFormField>

                <CompactFormField label="Tipo de solicitud" required error={formState.errors.tipoSolicitudId}>
                  <CompactComboboxQuery
                    {...TIPOS_SOLICITUD_REFERENCE}
                    value={values.tipoSolicitudId}
                    onChange={(value) =>
                      setValue("tipoSolicitudId", value, { shouldDirty: true })
                    }
                    placeholder="Selecciona tipo"
                    clearable
                    className="h-8 w-full"
                  />
                  <input
                    type="hidden"
                    {...register("tipoSolicitudId", { required: "El tipo de solicitud es obligatorio" })}
                  />
                </CompactFormField>
              </CompactFormGrid>

              <CompactFormField label="Oportunidad">
                <CompactOportunidadSelector
                  value={values.oportunidadId}
                  onChange={(value) =>
                    setValue("oportunidadId", value ?? "", { shouldDirty: true })
                  }
                  placeholder="Selecciona una oportunidad"
                  className="h-8 w-full justify-between"
                  filter={{ activo: true }}
                  dependsOn="activo-true"
                  clearable
                  showWideDropdown={false}
                />
              </CompactFormField>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalle
              </div>
              <div className="h-px w-full bg-muted/70" />
              <div className="rounded-md border border-border/60 bg-muted/30">
                <div className="grid grid-cols-[minmax(0,1fr)_56px_70px_70px] gap-1 px-2 py-1 text-[9px] uppercase text-muted-foreground">
                  <span className="truncate">Articulo</span>
                  <span className="text-center">Cant</span>
                  <span className="text-right">Precio</span>
                  <span className="text-right">Importe</span>
                </div>
                <div className="max-h-44 overflow-auto divide-y divide-border/60">
                  {editableDetalles.length ? (
                    editableDetalles.map((detalle, index) => {
                      const articuloId = Number(detalle.articulo_id);
                      const articuloLabel =
                        (detalle as any).articulo_nombre ||
                        articulosMap.get(articuloId) ||
                        (Number.isFinite(articuloId) ? `ID ${articuloId}` : "-");
                      const cantidadValue = normalizeNumber(detalle.cantidad);
                      const precioValue = normalizeNumber(detalle.precio);
                      const importeValue = roundCurrency(cantidadValue * precioValue);
                      return (
                        <div
                          key={detalle.id ?? `${detalle.articulo_id}-${detalle.descripcion}`}
                          className="grid grid-cols-[minmax(0,1fr)_56px_70px_70px] items-center gap-1 px-2 py-1 text-[9px] text-foreground"
                        >
                          <span className="truncate">{articuloLabel}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={Number.isFinite(cantidadValue) ? cantidadValue : ""}
                            onChange={(event) => {
                              const nextCantidad = normalizeNumber(event.target.value);
                              setEditableDetalles((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        cantidad: nextCantidad,
                                        importe: roundCurrency(nextCantidad * precioValue),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="h-5 px-1 !text-[9px] !leading-tight bg-yellow-50/60 border border-yellow-100/60 text-center tabular-nums font-normal focus-visible:border-yellow-200 focus-visible:ring-0"
                            aria-label={`Cantidad ${articuloLabel}`}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={Number.isFinite(precioValue) ? precioValue : ""}
                            onChange={(event) => {
                              const nextPrecio = normalizeNumber(event.target.value);
                              setEditableDetalles((prev) =>
                                prev.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        precio: nextPrecio,
                                        importe: roundCurrency(cantidadValue * nextPrecio),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="h-5 px-1 !text-[9px] !leading-tight bg-yellow-50/60 border border-yellow-100/60 text-right tabular-nums font-normal focus-visible:border-yellow-200 focus-visible:ring-0"
                            aria-label={`Precio ${articuloLabel}`}
                          />
                          <span className="text-right tabular-nums font-semibold">
                            {CURRENCY_FORMATTER.format(importeValue)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2 py-2 text-[9px] text-muted-foreground">
                      {solicitudId != null
                        ? "La solicitud no tiene items."
                        : "Selecciona un proveedor con articulo default o una solicitud."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between border-t bg-muted/30 -mx-6 px-6 py-0 min-h-8">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-1 h-6 px-2 text-xs leading-none"
            >
              ← Anterior
            </Button>
            
            <div className="text-xs text-muted-foreground leading-none">
              Paso {step} de 2
            </div>
            
            <Button 
              type="button"
              variant="outline" 
              onClick={handleNext}
              disabled={step === 2}
              className="flex items-center gap-1 h-6 px-2 text-xs leading-none"
            >
              Siguiente →
            </Button>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-0.5 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button 
              type="button"
              onClick={handleApply}
              disabled={step !== 2}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { CreateWizard2Component as create_wizard_2 };
