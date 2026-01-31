"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useDataProvider, useGetIdentity, useGetOne } from "ra-core";
import { useNavigate } from "react-router-dom";
import { Confirm } from "@/components/confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid, ResponsableSelector } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  PO_SOLICITUDES_REFERENCE,
  PROVEEDORES_REFERENCE,
  type PoOrdenCompraDetalle,
  type PoOrdenCompraWizardPayload,
} from "./model";
import type { PoSolicitudDetalle } from "../po-solicitudes/model";
import { CURRENCY_FORMATTER, roundCurrency } from "@/lib/formatters";
import { normalizeId, normalizeNumber } from "../shared/po-utils";

type WizardValues = {
  titulo: string;
  fecha: string;
  solicitudId: string;
  proveedorId: string;
  tipoSolicitudId: string;
  responsableId: string;
  oportunidadId: string;
};

export type CreateWizard2Payload = PoOrdenCompraWizardPayload;

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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const navigate = useNavigate();

  const defaultValues = useMemo(
    () => ({
      titulo: "",
      fecha: new Date().toISOString().slice(0, 10),
      solicitudId: "",
      proveedorId: "",
      tipoSolicitudId: "",
      responsableId: "",
      oportunidadId: "",
    }),
    []
  );

  const { register, trigger, formState, getValues, reset, setValue, watch } =
    useForm<WizardValues>({
      defaultValues,
    });
  const values = watch();
  const responsableFilterId = normalizeId(values.responsableId ?? "");
  const responsableId = normalizeId(values.responsableId ?? "");
  const solicitudFilter = responsableFilterId
    ? { solicitante_id: responsableFilterId }
    : undefined;
  const solicitudId = normalizeId(values.solicitudId ?? "");
  const { data: solicitudData } = useGetOne(
    "po-solicitudes",
    { id: solicitudId ?? 0 },
    { enabled: solicitudId != null }
  );
  const tipoSolicitudId = Number((solicitudData as any)?.tipo_solicitud_id ?? 0);
  const proveedorIdSelected = Number((solicitudData as any)?.proveedor_id ?? 0);
  const oportunidadIdSelected = (solicitudData as any)?.oportunidad_id ?? null;
  const proveedorIdResolved =
    proveedorIdSelected > 0 ? proveedorIdSelected : normalizeId(values.proveedorId ?? "");
  const needsProveedor = Boolean(solicitudId && (!proveedorIdSelected || proveedorIdSelected <= 0));
  const { data: tipoSolicitudData } = useGetOne(
    "tipos-solicitud",
    { id: tipoSolicitudId || 0 },
    { enabled: tipoSolicitudId > 0 }
  );
  const { data: proveedorData } = useGetOne(
    "proveedores",
    { id: proveedorIdResolved ?? 0 },
    { enabled: Boolean(proveedorIdResolved) }
  );
  const { data: oportunidadData } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadIdSelected || 0 },
    { enabled: Boolean(oportunidadIdSelected) }
  );
  const solicitudDetalles = useMemo(
    () =>
      Array.isArray((solicitudData as any)?.detalles)
        ? ((solicitudData as any).detalles as PoSolicitudDetalle[])
        : [],
    [solicitudData]
  );
  const { data: responsableData } = useGetOne(
    "users",
    { id: responsableId ?? 0 },
    { enabled: responsableId != null }
  );
  const [editableDetalles, setEditableDetalles] = useState<PoSolicitudDetalle[]>([]);
  const articuloIds = useRef<number[]>([]);
  const [articulosMap, setArticulosMap] = useState<Map<number, string>>(
    () => new Map()
  );
  const proveedorId = normalizeId(values.proveedorId ?? "");
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
      const solicitud = solicitudData as {
        departamento_id?: number | null;
        centro_costo_id?: number | null;
      } | null;
      const responsableDepartamento = (responsableData as { departamento_id?: number | null } | undefined)
        ?.departamento_id;
      const resolvedDepartamentoId =
        solicitud?.departamento_id != null
          ? Number(solicitud.departamento_id)
          : responsableDepartamento != null && Number.isFinite(Number(responsableDepartamento))
            ? Number(responsableDepartamento)
            : null;
      const proveedorDefaults = proveedorData as {
        default_metodo_pago_id?: number | null;
      };
      const metodoPagoId =
        proveedorDefaults?.default_metodo_pago_id != null
          ? Number(proveedorDefaults.default_metodo_pago_id)
          : null;
      const resolvedCentroCostoId =
        values.oportunidadId
          ? null
          : solicitud?.centro_costo_id != null
            ? Number(solicitud.centro_costo_id)
            : null;
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
      const resolvedFecha =
        values.fecha && String(values.fecha).trim().length > 0
          ? values.fecha
          : new Date().toISOString().slice(0, 10);
      onApply({
        titulo: values.titulo,
        fecha: resolvedFecha,
        proveedor_id: normalizeId(values.proveedorId) ?? undefined,
        tipo_solicitud_id: normalizeId(values.tipoSolicitudId) ?? undefined,
        usuario_responsable_id: normalizeId(values.responsableId) ?? undefined,
        // oportunidad_id: normalizeId(values.oportunidadId) ?? undefined,
        departamento_id: resolvedDepartamentoId ?? undefined,
        centro_costo_id: resolvedCentroCostoId ?? undefined,
        metodo_pago_id: metodoPagoId ?? undefined,
        tipo_compra: "normal",
        detalles: detallesPayload,
      });
      reset();
      setStep(1);
      onOpenChange(false);
    }
  };

  const handleNext = async () => {
    const fieldsToValidate: ("responsableId" | "solicitudId" | "proveedorId")[] = ["responsableId", "solicitudId"];
    if (needsProveedor) {
      fieldsToValidate.push("proveedorId");
    }
    const isValid = await trigger(fieldsToValidate as any);
    if (isValid) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleCancel = () => {
    const values = getValues();
    const hasChanges = Object.keys(defaultValues).some((key) => {
      const typedKey = key as keyof WizardValues;
      return String(values[typedKey] ?? "") !== String(defaultValues[typedKey] ?? "");
    });
    if (formState.isDirty || hasChanges) {
      setConfirmCancelOpen(true);
      return;
    }
    reset();
    setStep(1);
    onOpenChange(false);
    navigate("/po-ordenes-compra");
  };

  const handleConfirmCancel = () => {
    setConfirmCancelOpen(false);
    reset();
    setStep(1);
    onOpenChange(false);
    navigate("/po-ordenes-compra");
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
                  <input
                    type="hidden"
                    {...register("responsableId", { required: "El responsable es obligatorio" })}
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
                  <input
                    type="hidden"
                    {...register("solicitudId", { required: "La solicitud es obligatoria" })}
                  />
                </CompactFormField>
              </CompactFormGrid>
              {needsProveedor ? (
                <CompactFormGrid columns="one">
                  <CompactFormField
                    label="Proveedor"
                    required
                    error={formState.errors.proveedorId}
                  >
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
                      {...register("proveedorId", {
                        required: "El proveedor es obligatorio",
                      })}
                    />
                  </CompactFormField>
                </CompactFormGrid>
              ) : null}
              <input type="hidden" {...register("titulo")} />
              <input type="hidden" {...register("fecha")} />
              {!needsProveedor ? <input type="hidden" {...register("proveedorId")} /> : null}
              <input type="hidden" {...register("tipoSolicitudId")} />
              <input type="hidden" {...register("oportunidadId")} />

              {solicitudData ? (
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[10px] text-foreground">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Titulo:</span>
                      <span className="font-semibold">
                        {(solicitudData as any)?.titulo ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Proveedor:</span>
                      <span>{(proveedorData as any)?.nombre ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Tipo solicitud:</span>
                      <span>{(tipoSolicitudData as any)?.nombre ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Fecha necesidad:</span>
                      <span>
                        {(solicitudData as any)?.fecha_necesidad
                          ? String((solicitudData as any).fecha_necesidad).slice(0, 10)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Oportunidad:</span>
                      <span>
                        {(oportunidadData as any)?.titulo ??
                          (oportunidadData as any)?.descripcion_estado ??
                          "-"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground">Comentario:</span>
                      <span className="line-clamp-2">
                        {(solicitudData as any)?.comentario ?? "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
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
                  <span className="text-center">Precio</span>
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
                            className="h-5 px-1 !text-[9px] !leading-tight bg-muted/50 border border-border/60 text-center tabular-nums font-normal focus-visible:border-muted/70 focus-visible:ring-0"
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
                            className="h-5 px-1 !text-[9px] !leading-tight bg-muted/50 border border-border/60 text-right tabular-nums font-normal focus-visible:border-muted/70 focus-visible:ring-0"
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
      <Confirm
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Salir del asistente"
        content="Hay cambios sin guardar. ¿Deseas salir?"
        confirm="Salir"
        cancel="Volver"
      />
    </Dialog>
  );
};

export { CreateWizard2Component as create_wizard_2 };
