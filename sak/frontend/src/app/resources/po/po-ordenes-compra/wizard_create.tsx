/**
 * Wizard de creacion rapida de Ordenes de Compra.
 *
 * Estructura:
 * 1. TIPOS - Tipos auxiliares y contratos internos
 * 2. HELPERS - Helpers reutilizables para el wizard
 * 3. PASOS - Componentes de UI por paso
 * 4. WIZARD - Componente principal y handlers
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FormProvider,
  useForm,
  useWatch,
  type RegisterOptions,
  type UseFormRegister,
} from "react-hook-form";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useNavigate } from "react-router-dom";
import { PencilLine, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WizardConfirmCancel,
  WizardNavigation,
  WizardSectionHeader,
} from "@/components/wizard";
import {
  CompactComboboxQuery,
  CompactDateInput,
  CompactFormField,
  CompactFormGrid,
  CompactMultiSelectField,
  CompactNumberInput,
  CompactTextInput,
  ResponsableSelector,
} from "@/components/forms";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import { formatOportunidadLabel } from "../../crm-oportunidades/OportunidadSelector";
import {
  ARTICULOS_REFERENCE,
  CURRENCY_FORMATTER,
  CENTROS_COSTO_REFERENCE,
  OPORTUNIDADES_REFERENCE,
  PO_SOLICITUDES_REFERENCE,
  PROVEEDORES_REFERENCE,
  TIPOS_SOLICITUD_REFERENCE,
  WIZARD_DEFAULTS,
  normalizeId,
  normalizeNumber,
  roundCurrency,
} from "./model";
import type { WizardPayload } from "./model";
import {
  buildWizardPayload,
  useWizardDefaults,
} from "./form_hooks";
import {
  useArticuloById,
  useDepartamentoById,
  useProveedorById,
  useUserById,
} from "../shared/po-hooks";
import { useWizardCancel } from "../shared/po-hooks";
import { useCentroCostoWatcher, useReferenceFieldWatcher } from "@/components/generic";

//******************************* */
// region 1. TIPOS

// Contrato de valores que maneja el wizard.
type WizardValues = {
  titulo: string;
  fecha: string;
  proveedorId: string;
  usuarioResponsableId: string;
  oportunidadId: string;
  tipoSolicitudId: string;
  centroCostoId: string;
  solicitudes: Array<{ id: string }>;
  tipoCompra: string;
  articuloId: string;
  cantidad: number;
  precio: number;
  descripcion: string;
};
// endregion

//******************************* */
// region 2. HELPERS

// Registra un campo oculto para sincronizar valores no visuales.
const HiddenField = ({
  name,
  register,
  rules,
}: {
  name: keyof WizardValues;
  register: UseFormRegister<WizardValues>;
  rules?: RegisterOptions<WizardValues, keyof WizardValues>;
}) => <input type="hidden" {...register(name, rules)} />;
// endregion

//******************************* */
// region 3. PASOS

// Renderiza el paso de cabecera del wizard.
const WizardHeaderStep = ({
  responsableIdValue,
  proveedorIdValue,
  tipoSolicitudIdValue,
  register,
  setValue,
  formState,
}: {
  responsableIdValue: string | undefined;
  proveedorIdValue: string | undefined;
  tipoSolicitudIdValue: string | undefined;
  register: UseFormRegister<WizardValues>;
  setValue: ReturnType<typeof useForm<WizardValues>>["setValue"];
  formState: ReturnType<typeof useForm<WizardValues>>["formState"];
}) => (
    <div className="space-y-2">
    <WizardSectionHeader title="Cabecera" />
    <CompactFormGrid columns="one">
      <CompactFormField label="Responsable" required className="w-full">
        <ResponsableSelector
          includeTodos={false}
          value={responsableIdValue ?? ""}
          onValueChange={(value) =>
            setValue("usuarioResponsableId", value ?? "", { shouldDirty: true })
          }
          triggerClassName="w-full justify-between"
        />
        <HiddenField
          name="usuarioResponsableId"
          register={register}
          rules={{ required: "El responsable es obligatorio" }}
        />
      </CompactFormField>
    </CompactFormGrid>

    <CompactFormGrid columns="one">
      <CompactFormField label="Titulo" required>
        <CompactTextInput
          source="titulo"
          label={false}
          validate={(value) => (value ? undefined : "El titulo es obligatorio")}
        />
      </CompactFormField>
    </CompactFormGrid>

    <CompactFormGrid columns="one">
      <CompactFormField label="Proveedor" required>
        <CompactComboboxQuery
          {...PROVEEDORES_REFERENCE}
          value={proveedorIdValue ?? ""}
          onChange={(value) => setValue("proveedorId", value, { shouldDirty: true })}
          placeholder="Selecciona proveedor"
          clearable
        />
        <HiddenField
          name="proveedorId"
          register={register}
          rules={{ required: "El proveedor es obligatorio" }}
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
        />
        <HiddenField
          name="tipoSolicitudId"
          register={register}
          rules={{ required: "El tipo de solicitud es obligatorio" }}
        />
      </CompactFormField>
    </CompactFormGrid>

    <CompactFormGrid columns="one">
      <CompactFormField label="Solicitud">
        <CompactMultiSelectField
          name="solicitudes"
          valueKey="id"
          placeholder="Selecciona solicitud"
          comboboxProps={PO_SOLICITUDES_REFERENCE}
          filter={{
            estado: ["pendiente", "emitida"],
            ...(tipoSolicitudIdValue
              ? { tipo_solicitud_id: normalizeId(tipoSolicitudIdValue) }
              : {}),
          }}
          dependsOn={tipoSolicitudIdValue ?? "tipo-solicitud"}
          clearable
        />
      </CompactFormField>
    </CompactFormGrid>

  </div>
);

// Renderiza el paso de detalle del wizard.
const WizardDetailStep = ({
  articuloIdValue,
  cantidadValue,
  precioValue,
  centroCostoIdValue,
  oportunidadIdValue,
  register,
  setValue,
}: {
  articuloIdValue: string | undefined;
  cantidadValue: number | undefined;
  precioValue: number | undefined;
  centroCostoIdValue: string | undefined;
  oportunidadIdValue: string | undefined;
  register: UseFormRegister<WizardValues>;
  setValue: ReturnType<typeof useForm<WizardValues>>["setValue"];
}) => {
  const [showImputacionFields, setShowImputacionFields] = useState(false);
  const { data: centroCostoData } = useCentroCostoWatcher("centroCostoId");
  const { data: oportunidadData } = useReferenceFieldWatcher(
    "oportunidadId",
    OPORTUNIDADES_REFERENCE.resource,
    { validation: (value) => !!value && typeof value === "object" }
  );

  const oportunidadLabel = useMemo(() => {
    if (oportunidadData && typeof oportunidadData === "object") {
      return formatOportunidadLabel(oportunidadData);
    }
    if (oportunidadIdValue) return `#${oportunidadIdValue}`;
    return "";
  }, [oportunidadData, oportunidadIdValue]);

  const centroCostoLabel = useMemo(() => {
    if (centroCostoData && typeof centroCostoData === "object") {
      return String((centroCostoData as { nombre?: string }).nombre ?? "");
    }
    if (centroCostoIdValue) return `#${centroCostoIdValue}`;
    return "";
  }, [centroCostoData, centroCostoIdValue]);

  const imputacionLabel = oportunidadLabel
    ? `Oportunidad: ${oportunidadLabel}`
    : centroCostoLabel
      ? `Centro costo: ${centroCostoLabel}`
      : "";

  return (
  <>
    <WizardSectionHeader title="Detalle" />
    <HiddenField name="centroCostoId" register={register} />
    <HiddenField name="oportunidadId" register={register} />
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
          />
          <HiddenField
            name="articuloId"
            register={register}
            rules={{ required: "El articulo es obligatorio" }}
          />
        </CompactFormField>
      </CompactFormGrid>

      <CompactFormGrid columns="one">
        <div className="grid grid-cols-3 gap-2">
          <CompactFormField label="Cantidad" required>
            <CompactNumberInput
              source="cantidad"
              label={false}
              step={0.01}
              min={0}
              required
              validate={(value) =>
                value == null || value >= 0
                  ? undefined
                  : "La cantidad debe ser mayor o igual a 0"
              }
            />
          </CompactFormField>
          <CompactFormField label="Precio" required>
            <CompactNumberInput
              source="precio"
              label={false}
              step={0.01}
              min={0}
              required
              validate={(value) =>
                value == null || value >= 0
                  ? undefined
                  : "El precio debe ser mayor o igual a 0"
              }
            />
          </CompactFormField>
          <CompactFormField label="Importe">
            <CompactTextInput
              source="importe"
              label={false}
              readOnly
              tabIndex={-1}
              value={CURRENCY_FORMATTER.format(
                roundCurrency(
                  normalizeNumber(cantidadValue) *
                    normalizeNumber(precioValue)
                )
              )}
            />
          </CompactFormField>
        </div>
      </CompactFormGrid>

      <CompactFormField label="Descripcion">
        <CompactTextInput source="descripcion" label={false} />
      </CompactFormField>
    </div>

    <CompactFormField label="Imputacion">
      <div className="relative">
        <Input
          type="text"
          value={imputacionLabel || "-"}
          readOnly
          tabIndex={-1}
          className="h-7 w-full bg-muted/50 pr-9 text-[11px] sm:h-8 sm:text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          tabIndex={-1}
          onClick={() => setShowImputacionFields((prev) => !prev)}
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md border-border bg-background p-0 text-muted-foreground shadow-none transition hover:text-foreground"
          aria-label={
            showImputacionFields ? "Ocultar imputacion" : "Editar imputacion"
          }
        >
          <PencilLine className="h-3 w-3" />
        </Button>
      </div>
    </CompactFormField>

    {showImputacionFields ? (
      <div className="rounded-md border border-border/60 bg-muted/30 p-2">
        <CompactFormGrid columns="one">
          <CompactFormField label="Centro de costo">
            <CompactComboboxQuery
              {...CENTROS_COSTO_REFERENCE}
              value={centroCostoIdValue ?? ""}
              onChange={(value) =>
                setValue("centroCostoId", value, { shouldDirty: true })
              }
              placeholder="Selecciona centro"
              clearable
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
            className="w-full justify-between"
            filter={{ activo: true }}
            dependsOn="activo-true"
            clearable
            showWideDropdown={false}
          />
        </CompactFormField>
      </div>
    ) : null}
  </>
  );
};
// endregion

//******************************* */
// region 4. WIZARD

// Orquesta el wizard, sus pasos y la confirmacion de salida.
const WizardCreateComponent = ({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (payload: WizardPayload) => Promise<void> | void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: identity } = useGetIdentity();
  const navigate = useNavigate();
  const defaultValues = useMemo(() => WIZARD_DEFAULTS, []);

  const form = useForm<WizardValues>({ defaultValues });
  const { register, trigger, formState, getValues, reset, setValue, control } =
    form;
  const dataProvider = useDataProvider();

  const [
    responsableIdValue,
    proveedorIdValue,
    oportunidadIdValue,
    tipoSolicitudIdValue,
    centroCostoIdValue,
    solicitudesValue,
    articuloIdValue,
    cantidadValue,
    precioValue,
    fechaValue,
  ] = useWatch<WizardValues>({
    control,
    name: [
      "usuarioResponsableId",
      "proveedorId",
      "oportunidadId",
      "tipoSolicitudId",
      "centroCostoId",
      "solicitudes",
      "articuloId",
      "cantidad",
      "precio",
      "fecha",
    ],
  });

  const proveedorId = normalizeId(String(proveedorIdValue ?? ""));
  const { data: proveedorData } = useProveedorById(proveedorId);

  const responsableId = normalizeId(String(responsableIdValue ?? ""));
  const { data: responsableData } = useUserById(responsableId);
  const responsableDepartamentoId =
    (responsableData as { departamento_id?: number | null } | undefined)
      ?.departamento_id ?? null;
  const { data: departamentoData } = useDepartamentoById(
    responsableDepartamentoId
  );

  const articuloId = normalizeId(String(articuloIdValue ?? ""));
  const { data: articuloData } = useArticuloById(articuloId);

  const unidadMedida =
    (articuloData as { unidad_medida?: string } | undefined)?.unidad_medida ?? "UN";

  const identityId =
    identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;

  useWizardDefaults({
    proveedorData,
    articuloIdValue: String(articuloIdValue ?? ""),
    articuloData,
    precioValue,
    setValue,
    responsableIdValue: identityId != null ? String(identityId) : undefined,
  });

  useEffect(() => {
    const currentCentro = String(centroCostoIdValue ?? "");
    if (currentCentro.trim().length > 0) return;
    const deptoCentro = (departamentoData as { centro_costo_id?: number | null } | undefined)
      ?.centro_costo_id;
    if (deptoCentro != null) {
      setValue("centroCostoId", String(deptoCentro), { shouldDirty: true });
    }
  }, [centroCostoIdValue, departamentoData, setValue]);

  useEffect(() => {
    if (fechaValue) return;
    const today = new Date().toISOString().slice(0, 10);
    setValue("fecha", today, { shouldDirty: false });
  }, [fechaValue, setValue]);

  const hasSolicitudesSelected =
    Array.isArray(solicitudesValue) &&
    solicitudesValue.some((value) => {
      const rawId =
        typeof value === "string"
          ? value
          : value && typeof value === "object"
            ? (value as { id?: string | number }).id
            : "";
      return String(rawId ?? "").trim().length > 0;
    });

  const handleApply = async () => {
    const isValid = await trigger();
    if (!isValid) return;
    const values = getValues();
    const selectedSolicitudes = (values.solicitudes ?? [])
      .map((item) => item?.id)
      .filter((value) => String(value ?? "").trim().length > 0);
    try {
      const basePayload = buildWizardPayload({
        values,
        proveedorId,
        responsableData:
          (responsableData as { departamento_id?: number | null } | undefined) ??
          null,
        proveedorData,
        unidadMedida,
        departamentoData:
          (departamentoData as { centro_costo_id?: number | null } | undefined) ??
          null,
      });

      if (selectedSolicitudes.length > 0) {
        const solicitudes = await Promise.all(
          selectedSolicitudes.map((id) =>
            dataProvider.getOne(PO_SOLICITUDES_REFERENCE.resource, { id })
          )
        );

        const detalles = solicitudes.flatMap(({ data }) => {
          const solicitud = data as any;
          const detallesSolicitud = Array.isArray(solicitud?.detalles)
            ? solicitud.detalles
            : [];

          return detallesSolicitud.map((detalle: any) => {
            const cantidad = Number(detalle.cantidad ?? 0) || 0;
            const precio = Number(detalle.precio ?? 0) || 0;
            const subtotal = cantidad * precio;
            return {
              articulo_id: Number(detalle.articulo_id),
              descripcion: detalle.descripcion ?? "",
              unidad_medida: detalle.unidad_medida ?? "UN",
              cantidad,
              precio_unitario: precio,
              subtotal,
              total_linea: subtotal,
              centro_costo_id: solicitud?.centro_costo_id ?? null,
              oportunidad_id: solicitud?.oportunidad_id ?? null,
              po_solicitud_id: solicitud?.id ?? null,
            };
          });
        });

        await onApply({ ...basePayload, detalles });
      } else {
        await onApply(basePayload);
      }
      reset();
      setStep(1);
      onOpenChange(false);
    } catch (error) {
      // Los errores ya se notifican en el dataProvider.
      return;
    }
  };

  const handleNext = async () => {
    const isValid = await trigger([
      "titulo",
      "proveedorId",
      "tipoSolicitudId",
      "usuarioResponsableId",
    ]);
    if (isValid && !hasSolicitudesSelected) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const { handleCancel, handleConfirmCancel } = useWizardCancel({
    defaultValues,
    formState,
    getValues,
    reset,
    setStep,
    onOpenChange,
    navigate,
    setConfirmCancelOpen,
    navigateTo: "/po-ordenes-compra",
  });

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleCancel();
      return;
    }
    onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <FormProvider {...form}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <span>Crear Orden de Compra</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {step === 1 && (
              <WizardHeaderStep
                responsableIdValue={String(responsableIdValue ?? "")}
                proveedorIdValue={String(proveedorIdValue ?? "")}
                tipoSolicitudIdValue={String(tipoSolicitudIdValue ?? "")}
                register={register}
                setValue={setValue}
                formState={formState}
              />
            )}

            {step === 2 && (
              <WizardDetailStep
                articuloIdValue={String(articuloIdValue ?? "")}
                cantidadValue={
                  typeof cantidadValue === "number"
                    ? cantidadValue
                    : typeof cantidadValue === "string"
                      ? Number(cantidadValue) || undefined
                      : undefined
                }
                precioValue={
                  typeof precioValue === "number"
                    ? precioValue
                    : typeof precioValue === "string"
                      ? Number(precioValue) || undefined
                      : undefined
                }
                centroCostoIdValue={String(centroCostoIdValue ?? "")}
                oportunidadIdValue={String(oportunidadIdValue ?? "")}
                register={register}
                setValue={setValue}
              />
            )}

            <WizardNavigation
              step={step}
              totalSteps={2}
              onBack={handleBack}
              onNext={handleNext}
              disableBack={step === 1}
              disableNext={step === 2 || hasSolicitudesSelected}
              backTabIndex={-1}
            />

            <div className="flex justify-end gap-2 pt-0.5 border-t">
              <Button type="button" variant="outline" onClick={handleCancel} tabIndex={-1}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                disabled={step !== 2 && !hasSolicitudesSelected}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </FormProvider>
      <WizardConfirmCancel
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </Dialog>
  );
};

export { WizardCreateComponent as wizard_create };
// endregion
