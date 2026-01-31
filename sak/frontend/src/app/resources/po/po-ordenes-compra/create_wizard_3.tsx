"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetIdentity, useGetOne } from "ra-core";
import { useNavigate } from "react-router-dom";
import { Confirm } from "@/components/confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompactComboboxQuery, CompactFormField, CompactFormGrid, ResponsableSelector } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ARTICULOS_REFERENCE, PROVEEDORES_REFERENCE, type PoOrdenCompraDetalle, type PoOrdenCompraWizardPayload } from "./model";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import { CURRENCY_FORMATTER, roundCurrency } from "@/lib/formatters";
import { normalizeId, normalizeNumber } from "../shared/po-utils";

type WizardValues = {
  titulo: string;
  fecha: string;
  proveedorId: string;
  responsableId: string;
  oportunidadId: string;
  articuloId: string;
  cantidad: number;
  precio: number;
  descripcion: string;
};

export type CreateWizard3Payload = PoOrdenCompraWizardPayload;

const CreateWizard3Component = ({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: CreateWizard3Payload) => void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: identity } = useGetIdentity();
  const navigate = useNavigate();

  const defaultValues = useMemo(
    () => ({
      titulo: "",
      fecha: "",
      proveedorId: "",
      responsableId: "",
      oportunidadId: "",
      articuloId: "",
      cantidad: 1,
      precio: 0,
      descripcion: "",
    }),
    []
  );

  const { register, trigger, formState, getValues, reset, setValue, watch } =
    useForm<WizardValues>({
      defaultValues,
    });
  const responsableIdValue = watch("responsableId");
  const proveedorIdValue = watch("proveedorId");
  const oportunidadIdValue = watch("oportunidadId");
  const articuloIdValue = watch("articuloId");
  const cantidadValue = watch("cantidad");
  const precioValue = watch("precio");
  const responsableId = normalizeId(responsableIdValue ?? "");
  const { data: responsableData } = useGetOne(
    "users",
    { id: responsableId ?? 0 },
    { enabled: responsableId != null }
  );
  const proveedorId = normalizeId(proveedorIdValue ?? "");
  const { data: proveedorData } = useGetOne(
    "proveedores",
    { id: proveedorId ?? 0 },
    { enabled: proveedorId != null }
  );
  const responsableDepartamentoIdValue =
    (responsableData as { departamento_id?: number | null } | undefined)?.departamento_id ??
    null;
  const { data: departamentoData } = useGetOne(
    "departamentos",
    { id: responsableDepartamentoIdValue ?? 0 },
    { enabled: responsableDepartamentoIdValue != null }
  );
  const articuloId = normalizeId(articuloIdValue ?? "");
  const { data: articuloData } = useGetOne(
    "articulos",
    { id: articuloId ?? 0 },
    { enabled: articuloId != null }
  );
  const identityId =
    identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;

  useEffect(() => {
    const defaultArticuloId = Number((proveedorData as any)?.default_articulos_id ?? 0);
    if (!Number.isFinite(defaultArticuloId) || defaultArticuloId <= 0) {
      return;
    }
    if (articuloIdValue) {
      return;
    }
    setValue("articuloId", String(defaultArticuloId), { shouldDirty: true });
  }, [articuloIdValue, proveedorData, setValue]);

  useEffect(() => {
    const precioActual = normalizeNumber(precioValue);
    if (precioActual > 0) {
      return;
    }
    const precioArticulo = Number((articuloData as { precio?: number | string | null } | undefined)?.precio);
    if (!Number.isFinite(precioArticulo) || precioArticulo <= 0) {
      return;
    }
    setValue("precio", precioArticulo, { shouldDirty: true });
  }, [articuloData, precioValue, setValue]);

  useEffect(() => {
    if (!identityId) return;
    if (responsableIdValue) return;
    setValue("responsableId", String(identityId), { shouldDirty: false });
  }, [identityId, responsableIdValue, setValue]);

  const handleApply = async () => {
    const isValid = await trigger();
    if (isValid) {
        const values = getValues();
        const cantidad = normalizeNumber(values.cantidad);
        const precio = normalizeNumber(values.precio);
      const subtotal = roundCurrency(cantidad * precio);
      const resolvedDepartamentoId =
        responsableDepartamentoIdValue != null &&
        Number.isFinite(Number(responsableDepartamentoIdValue))
          ? Number(responsableDepartamentoIdValue)
          : null;
      const defaultCentroCostoId = Number(
        (departamentoData as { centro_costo_id?: number | null } | undefined)
          ?.centro_costo_id ?? 0
      );
      const resolvedCentroCostoId =
        values.oportunidadId
          ? null
          : Number.isFinite(defaultCentroCostoId) && defaultCentroCostoId > 0
            ? defaultCentroCostoId
            : null;
      const proveedorDefaults = proveedorData as {
        default_tipo_solicitud_id?: number | null;
        default_metodo_pago_id?: number | null;
      };
      const tipoSolicitudId =
        proveedorDefaults?.default_tipo_solicitud_id != null
          ? Number(proveedorDefaults.default_tipo_solicitud_id)
          : null;
        const metodoPagoId =
          proveedorDefaults?.default_metodo_pago_id != null
            ? Number(proveedorDefaults.default_metodo_pago_id)
            : null;
      const detallesPayload = values.articuloId
        ? [
            {
              articulo_id: normalizeId(values.articuloId),
              po_solicitud_id: null,
              descripcion: values.descripcion ?? "",
              unidad_medida: "UN",
              cantidad,
              precio_unitario: precio,
              subtotal,
              porcentaje_descuento: 0,
              importe_descuento: 0,
              porcentaje_iva: 0,
              importe_iva: 0,
              total_linea: subtotal,
            } as PoOrdenCompraDetalle,
          ]
        : undefined;
      const resolvedFecha =
        values.fecha && String(values.fecha).trim().length > 0
          ? values.fecha
          : new Date().toISOString().slice(0, 10);
      onApply({
        titulo: values.titulo,
        fecha: resolvedFecha,
        proveedor_id: normalizeId(values.proveedorId) ?? undefined,
        usuario_responsable_id: normalizeId(values.responsableId) ?? undefined,
        // oportunidad_id: normalizeId(values.oportunidadId) ?? undefined,
        departamento_id: resolvedDepartamentoId ?? undefined,
        centro_costo_id: resolvedCentroCostoId ?? undefined,
        tipo_solicitud_id: tipoSolicitudId ?? undefined,
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
    const isValid = await trigger(["titulo", "proveedorId"]);
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
              <CompactFormGrid columns="one">
                <CompactFormField label="Responsable" required className="w-full">
                  <ResponsableSelector
                    includeTodos={false}
                    value={responsableIdValue ?? ""}
                    onValueChange={(value) =>
                      setValue("responsableId", value ?? "", { shouldDirty: true })
                    }
                    triggerClassName="w-full justify-between"
                  />
                </CompactFormField>
              </CompactFormGrid>

              <CompactFormGrid columns="one">
                <CompactFormField label="Titulo" required error={formState.errors.titulo}>
                  <Input
                    id="titulo"
                    {...register("titulo", { required: "El titulo es obligatorio" })}
                    className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                </CompactFormField>
              </CompactFormGrid>

              <CompactFormGrid columns="one">
                <CompactFormField label="Proveedor" required error={formState.errors.proveedorId}>
                  <CompactComboboxQuery
                    {...PROVEEDORES_REFERENCE}
                    value={proveedorIdValue ?? ""}
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
              </CompactFormGrid>

              <CompactFormField label="Oportunidad">
                <CompactOportunidadSelector
                  value={oportunidadIdValue ?? ""}
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
                <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                  <CompactFormGrid columns="one">
                    <CompactFormField label="Articulo" required>
                    <CompactComboboxQuery
                      {...ARTICULOS_REFERENCE}
                      value={articuloIdValue ?? ""}
                      onChange={(value: string) =>
                        setValue("articuloId", value, { shouldDirty: true })
                      }
                      placeholder="Selecciona articulo"
                      clearable
                      className="h-8 w-full"
                      dependsOn={proveedorId ? String(proveedorId) : "all"}
                    />
                    <input
                      type="hidden"
                      {...register("articuloId", { required: "El articulo es obligatorio" })}
                    />
                  </CompactFormField>
                </CompactFormGrid>

                  <CompactFormGrid columns="one">
                    <div className="grid grid-cols-3 gap-2">
                    <CompactFormField label="Cantidad" required>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register("cantidad", { valueAsNumber: true, min: 0 })}
                        className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-2 sm:text-sm"
                      />
                    </CompactFormField>
                    <CompactFormField label="Precio" required>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register("precio", { valueAsNumber: true, min: 0 })}
                        className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-2 sm:text-sm"
                      />
                    </CompactFormField>
                    <CompactFormField label="Importe">
                      <Input
                        type="text"
                        value={CURRENCY_FORMATTER.format(
                          roundCurrency(
                            normalizeNumber(cantidadValue) * normalizeNumber(precioValue)
                          )
                        )}
                        readOnly
                        className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-2 sm:text-sm bg-muted/50"
                      />
                    </CompactFormField>
                  </div>
                  </CompactFormGrid>

                  <CompactFormField label="Descripcion">
                    <Input
                      id="descripcion"
                      {...register("descripcion")}
                      className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                    />
                  </CompactFormField>
                </div>

              <CompactFormGrid columns="one">
                <CompactFormField label="Fecha necesidad" error={formState.errors.fecha}>
                  <Input
                    id="fecha"
                    type="date"
                    {...register("fecha")}
                    className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                </CompactFormField>
              </CompactFormGrid>
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

export { CreateWizard3Component as create_wizard_3 };
