/**
 * Wizard de creacion rapida de PoSolicitudes.
 *
 * Estructura:
 * 1. TIPOS - Tipos auxiliares y contratos internos
 * 2. HELPERS - Helpers reutilizables para el wizard
 * 3. PASOS - Componentes de UI por paso
 * 4. WIZARD - Componente principal y handlers
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FormProvider,
  useForm,
  useWatch,
  type RegisterOptions,
  type UseFormRegister,
} from "react-hook-form";
import { required, useGetIdentity } from "ra-core";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  CompactNumberInput,
  CompactTextInput,
  ResponsableSelector,
} from "@/components/forms";
import { CompactOportunidadSelector } from "../../crm-oportunidades";
import {
  ARTICULOS_REFERENCE,
  CURRENCY_FORMATTER,
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
  useDefaultOportunidadFromLocation,
  useWizardDefaults,
} from "./form_hooks";
import {
  useArticuloById,
  useDepartamentoById,
  useProveedorById,
  useTipoSolicitudCatalog,
  useUserById,
} from "../shared/po-hooks";
import { useArticuloFilterByTipoSolicitud, useWizardCancel } from "../shared/po-hooks";

//******************************* */
// region 1. TIPOS

// Contrato de valores que maneja el wizard.
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

type DepartamentoData = {
  nombre?: string;
  centro_costo_id?: number | null;
};

type SolicitanteData = {
  departamento_id?: number | null;
  centro_costo_id?: number | null;
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
  solicitanteIdValue,
  proveedorIdValue,
  tipoSolicitudIdValue,
  oportunidadIdValue,
  oportunidadLocked,
  register,
  setValue,
  formState,
}: {
  solicitanteIdValue: string | undefined;
  proveedorIdValue: string | undefined;
  tipoSolicitudIdValue: string | undefined;
  oportunidadIdValue: string | undefined;
  oportunidadLocked: boolean;
  register: UseFormRegister<WizardValues>;
  setValue: ReturnType<typeof useForm<WizardValues>>["setValue"];
  formState: ReturnType<typeof useForm<WizardValues>>["formState"];
}) => (
  <div className="space-y-2">
    <WizardSectionHeader title="Cabecera" />
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
        <HiddenField
          name="solicitanteId"
          register={register}
          rules={{ required: "El solicitante es obligatorio" }}
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
      <CompactFormField label="Proveedor">
        <CompactComboboxQuery
          {...PROVEEDORES_REFERENCE}
          value={proveedorIdValue ?? ""}
          onChange={(value) => setValue("proveedorId", value, { shouldDirty: true })}
          placeholder="Selecciona proveedor"
          clearable
        />
        <HiddenField name="proveedorId" register={register} />
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
        dependsOn={oportunidadLocked ? "locked-oportunidad" : "activo-true"}
        clearable={!oportunidadLocked}
        showWideDropdown={false}
        disabled={oportunidadLocked}
      />
    </CompactFormField>
  </div>
);

// Renderiza el paso de detalle del wizard.
const WizardDetailStep = ({
  articuloIdValue,
  cantidadValue,
  precioValue,
  tipoSolicitudIdValue,
  articuloFilterId,
  register,
  setValue,
}: {
  articuloIdValue: string | undefined;
  cantidadValue: number | undefined;
  precioValue: number | undefined;
  tipoSolicitudIdValue: string | undefined;
  articuloFilterId?: number;
  register: UseFormRegister<WizardValues>;
  setValue: ReturnType<typeof useForm<WizardValues>>["setValue"];
}) => (
  <>
    <WizardSectionHeader title="Detalle" />
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
            filter={articuloFilterId ? { tipo_articulo_id: articuloFilterId } : {}}
            dependsOn={tipoSolicitudIdValue ?? "tipo-solicitud"}
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

    <CompactFormGrid columns="one">
      <CompactFormField label="Fecha necesidad">
        <CompactDateInput source="fechaNecesidad" label={false} tabIndex={-1} />
      </CompactFormField>
    </CompactFormGrid>
  </>
);
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

  const [
    solicitanteIdValue,
    proveedorIdValue,
    oportunidadIdValue,
    tipoSolicitudIdValue,
    departamentoIdValue,
    articuloIdValue,
    cantidadValue,
    precioValue,
  ] = useWatch<WizardValues>({
    control,
    name: [
      "solicitanteId",
      "proveedorId",
      "oportunidadId",
      "tipoSolicitudId",
      "departamentoId",
      "articuloId",
      "cantidad",
      "precio",
    ],
  });

  const proveedorId = normalizeId(String(proveedorIdValue ?? ""));
  const { data: proveedorData } = useProveedorById(proveedorId);

  const solicitanteId = normalizeId(String(solicitanteIdValue ?? ""));
  const { data: solicitanteData } = useUserById(solicitanteId);
  const solicitanteDepartamentoIdValue =
    (solicitanteData as SolicitanteData | undefined)?.departamento_id ?? null;
  const { data: departamentoData } = useDepartamentoById(
    solicitanteDepartamentoIdValue
  );

  const { tiposSolicitudCatalog } = useTipoSolicitudCatalog();
  const { articuloFilterId } = useArticuloFilterByTipoSolicitud({
    tipoSolicitudId: tipoSolicitudIdValue ? String(tipoSolicitudIdValue) : undefined,
    tiposSolicitudCatalog,
  });

  const prevTipoSolicitudRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentTipo = tipoSolicitudIdValue ? String(tipoSolicitudIdValue) : undefined;
    if (prevTipoSolicitudRef.current && prevTipoSolicitudRef.current !== currentTipo) {
      setValue("articuloId", "", { shouldDirty: true, shouldValidate: true });
      setValue("cantidad", 1, { shouldDirty: true, shouldValidate: true });
      setValue("precio", 0, { shouldDirty: true, shouldValidate: true });
      setValue("descripcion", "", { shouldDirty: true, shouldValidate: true });
    }
    prevTipoSolicitudRef.current = currentTipo;
  }, [setValue, tipoSolicitudIdValue]);

  const articuloId = normalizeId(String(articuloIdValue ?? ""));
  const { data: articuloData } = useArticuloById(articuloId);

  const unidadMedida =
    (articuloData as { unidad_medida?: string } | undefined)?.unidad_medida ?? "UN";

  const identityId =
    identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;

  useWizardDefaults({
    identityId,
    solicitanteIdValue: String(solicitanteIdValue ?? ""),
    departamentoIdValue: String(departamentoIdValue ?? ""),
    solicitanteDepartamentoIdValue,
    proveedorData,
    articuloIdValue: String(articuloIdValue ?? ""),
    articuloData,
    precioValue,
    setValue,
  });

  const { oportunidadIdFromLocation } = useDefaultOportunidadFromLocation({
    setValue,
    oportunidadIdValue: String(oportunidadIdValue ?? ""),
  });
  const oportunidadLocked = Boolean(oportunidadIdFromLocation);

  const handleApply = async () => {
    const isValid = await trigger();
    if (!isValid) return;
    const values = getValues();
    try {
      await onApply(
        buildWizardPayload({
          values,
          proveedorId,
          solicitanteDepartamentoIdValue,
          departamentoData: (departamentoData as DepartamentoData | undefined) ?? null,
          solicitanteData: (solicitanteData as SolicitanteData | undefined) ?? null,
          unidadMedida,
        })
      );
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

  const { handleCancel, handleConfirmCancel } = useWizardCancel({
    defaultValues,
    formState,
    getValues,
    reset,
    setStep,
    onOpenChange,
    navigate,
    setConfirmCancelOpen,
    navigateTo: "/po-solicitudes",
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
              <span>Crear Solicitud</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {step === 1 && (
      <WizardHeaderStep
        solicitanteIdValue={String(solicitanteIdValue ?? "")}
        proveedorIdValue={String(proveedorIdValue ?? "")}
        tipoSolicitudIdValue={String(tipoSolicitudIdValue ?? "")}
        oportunidadIdValue={String(oportunidadIdValue ?? "")}
        oportunidadLocked={oportunidadLocked}
        register={register}
        setValue={setValue}
                formState={formState}
              />
            )}

            {step === 2 && (
      <WizardDetailStep
        articuloIdValue={String(articuloIdValue ?? "")}
        cantidadValue={typeof cantidadValue === 'number' ? cantidadValue : (typeof cantidadValue === 'string' ? Number(cantidadValue) || undefined : undefined)}
        precioValue={typeof precioValue === 'number' ? precioValue : (typeof precioValue === 'string' ? Number(precioValue) || undefined : undefined)}
        tipoSolicitudIdValue={String(tipoSolicitudIdValue ?? "")}
        articuloFilterId={articuloFilterId}
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
              disableNext={step === 2}
              backTabIndex={-1}
            />

            <div className="flex justify-end gap-2 pt-0.5 border-t">
              <Button type="button" variant="outline" onClick={handleCancel} tabIndex={-1}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleApply} disabled={step !== 2}>
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
