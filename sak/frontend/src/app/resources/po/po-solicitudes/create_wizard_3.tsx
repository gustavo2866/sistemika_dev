"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useGetIdentity } from "ra-core";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactFormGrid,
  ResponsableSelector,
} from "@/components/forms";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import {
  ARTICULOS_REFERENCE,
  CURRENCY_FORMATTER,
  PROVEEDORES_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  normalizeId,
  normalizeNumber,
  normalizeOptionalNumber,
  resolveCentroCostoId,
  resolveTipoCompra,
  roundCurrency,
} from "./model";
import type { WizardPayload } from "./model";
import {
  useArticuloById,
  useDefaultArticuloFromProveedor,
  useDefaultDepartamentoFromSolicitante,
  useDefaultPrecioFromArticulo,
  useDefaultSolicitanteFromIdentity,
  useDepartamentoById,
  useProveedorById,
  useUserById,
} from "./hooks";

type WizardValues = {
  titulo: string;
  fechaNecesidad: string;
  proveedorId: string;
  solicitanteId: string;
  oportunidadId: string;
  tipoSolicitudId: string;
  departamentoId: string;
  tipoCompra: string;
  articuloId: string;
  cantidad: number;
  precio: number;
  descripcion: string;
};

export type CreateWizardPayload = WizardPayload;

const CreateWizard3Component = ({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: CreateWizardPayload) => void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: identity } = useGetIdentity();
  const navigate = useNavigate();
  const defaultValues = useMemo(
    () => ({
      titulo: "",
      fechaNecesidad: "",
      proveedorId: "",
      solicitanteId: "",
      oportunidadId: "",
      tipoSolicitudId: "",
      departamentoId: "",
      tipoCompra: "normal",
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

  const solicitanteIdValue = watch("solicitanteId");
  const proveedorIdValue = watch("proveedorId");
  const oportunidadIdValue = watch("oportunidadId");
  const tipoSolicitudIdValue = watch("tipoSolicitudId");
  const departamentoIdValue = watch("departamentoId");
  const articuloIdValue = watch("articuloId");
  const cantidadValue = watch("cantidad");
  const precioValue = watch("precio");
  const fechaNecesidadValue = watch("fechaNecesidad");

  const proveedorId = normalizeId(proveedorIdValue ?? "");
  const { data: proveedorData } = useProveedorById(proveedorId);

  const solicitanteId = normalizeId(solicitanteIdValue ?? "");
  const { data: solicitanteData } = useUserById(solicitanteId);
  const solicitanteDepartamentoIdValue =
    (solicitanteData as { departamento_id?: number | null } | undefined)?.departamento_id ??
    null;
  const { data: departamentoData } = useDepartamentoById(
    solicitanteDepartamentoIdValue
  );

  const articuloId = normalizeId(articuloIdValue ?? "");
  const { data: articuloData } = useArticuloById(articuloId);

  const unidadMedida =
    (articuloData as { unidad_medida?: string } | undefined)?.unidad_medida ?? "UN";

  const identityId =
    identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;

  useDefaultSolicitanteFromIdentity({
    identityId,
    solicitanteIdValue,
    setValue,
  });

  useDefaultDepartamentoFromSolicitante({
    departamentoIdValue,
    solicitanteDepartamentoIdValue,
    setValue,
  });

  useDefaultArticuloFromProveedor({
    proveedorData,
    articuloIdValue,
    setValue,
  });

  useDefaultPrecioFromArticulo({
    articuloData,
    precioValue,
    setValue,
  });

  const handleApply = async () => {
    const isValid = await trigger();
    if (!isValid) return;
    const values = getValues();
    const cantidad = normalizeNumber(values.cantidad);
    const precio = normalizeNumber(values.precio);
    const resolvedFecha =
      values.fechaNecesidad && String(values.fechaNecesidad).trim().length > 0
        ? values.fechaNecesidad
        : null;
    const resolvedDepartamentoId =
      normalizeId(values.departamentoId) ??
      (solicitanteDepartamentoIdValue != null
        ? Number(solicitanteDepartamentoIdValue)
        : null);
    const departamentoNombre = (departamentoData as { nombre?: string } | undefined)
      ?.nombre;
    const resolvedCentroCostoId = resolveCentroCostoId({
      oportunidadId: values.oportunidadId ?? null,
      departamentoNombre: departamentoNombre ?? null,
      departamentoCentroCostoId: (departamentoData as { centro_costo_id?: number | null } | undefined)
        ?.centro_costo_id ?? null,
      solicitanteCentroCostoId: (solicitanteData as { centro_costo_id?: number | null } | undefined)
        ?.centro_costo_id ?? null,
    });
    const resolvedTipoCompra = resolveTipoCompra(proveedorId);
    onApply({
      proveedorId: normalizeId(values.proveedorId),
      tipoSolicitudId: normalizeId(values.tipoSolicitudId),
      departamentoId: resolvedDepartamentoId,
      centroCostoId: resolvedCentroCostoId,
      tipoCompra: resolvedTipoCompra,
      articuloId: normalizeId(values.articuloId),
      titulo: values.titulo,
      descripcion: values.descripcion ?? "",
      fechaNecesidad: resolvedFecha,
      oportunidadId: normalizeId(values.oportunidadId),
      cantidad: values.articuloId ? normalizeOptionalNumber(cantidad) : null,
      precio: values.articuloId ? normalizeOptionalNumber(precio) : null,
      unidadMedida,
    });
    reset();
    setStep(1);
    onOpenChange(false);
  };

  const handleNext = async () => {
    const isValid = await trigger([
      "titulo",
      "tipoSolicitudId",
      "solicitanteId",
    ]);
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
    navigate("/po-solicitudes");
  };

  const handleConfirmCancel = () => {
    setConfirmCancelOpen(false);
    reset();
    setStep(1);
    onOpenChange(false);
    navigate("/po-solicitudes");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <span>Crear Solicitud</span>
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
                <CompactFormField label="Solicitante" required className="w-full">
                  <ResponsableSelector
                    includeTodos={false}
                    value={solicitanteIdValue ?? ""}
                    onValueChange={(value) =>
                      setValue("solicitanteId", value ?? "", { shouldDirty: true })
                    }
                    triggerClassName="w-full justify-between"
                  />
                  <input
                    type="hidden"
                    {...register("solicitanteId", {
                      required: "El solicitante es obligatorio",
                    })}
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
                <CompactFormField
                  label="Tipo de solicitud"
                  required
                  error={formState.errors.tipoSolicitudId}
                >
                  <CompactComboboxQuery
                    {...TIPOS_SOLICITUD_REFERENCE}
                    value={tipoSolicitudIdValue ?? ""}
                    onChange={(value) =>
                      setValue("tipoSolicitudId", value, { shouldDirty: true })
                    }
                    placeholder="Selecciona tipo"
                    clearable
                    className="h-8 w-full"
                  />
                  <input
                    type="hidden"
                    {...register("tipoSolicitudId", {
                      required: "El tipo de solicitud es obligatorio",
                    })}
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

              <CompactFormGrid columns="one">
                <CompactFormField label="Proveedor">
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
                  <input type="hidden" {...register("proveedorId")} />
                </CompactFormField>
              </CompactFormGrid>

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
                    />
                    <input
                      type="hidden"
                      {...register("articuloId", {
                        required: "El articulo es obligatorio",
                      })}
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
                            normalizeNumber(cantidadValue) *
                              normalizeNumber(precioValue)
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
                <CompactFormField label="Fecha necesidad">
                  <Input
                    id="fecha"
                    type="date"
                    value={fechaNecesidadValue ?? ""}
                    onChange={(event) =>
                      setValue("fechaNecesidad", event.target.value, { shouldDirty: true })
                    }
                    className="h-7 w-full px-2 text-[11px] sm:h-8 sm:px-3 sm:text-sm"
                  />
                  <input type="hidden" {...register("fechaNecesidad")} />
                </CompactFormField>
              </CompactFormGrid>
            </>
          )}

          <div className="flex items-center justify-between border-t bg-muted/30 -mx-6 px-6 py-0 min-h-8">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-1 h-6 px-2 text-xs leading-none"
            >
              {"<-"} Anterior
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
              Siguiente {"->"}
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-0.5 border-t">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleApply} disabled={step !== 2}>
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
        content="Hay cambios sin guardar. Deseas salir?"
        confirm="Salir"
        cancel="Volver"
      />
    </Dialog>
  );
};

export { CreateWizard3Component as create_wizard_3 };
