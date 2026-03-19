"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ReferenceInput } from "@/components/reference-input";
import {
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CRMOportunidad } from "./model";
import { AccionOportunidadHeader } from "./accion_header";
import type { PanelChange } from "../crm-panel/model";
import type { OportunidadModalBackground } from "./modal_background";
import { renderOportunidadModalBackground } from "./modal_background";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

const normalizeNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveNumericId = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown; value?: unknown }).id ??
      (value as { value?: unknown }).value;
    return resolveNumericId(maybeId);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  return undefined;
};

export const CRMOportunidadAccionReservar = () => {
  const { id } = useParams();
  const oportunidadId = Number(id);
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const { identity } = useGetIdentity();
  const locationState = location.state as
    | { returnTo?: string; panelChange?: PanelChange; background?: OportunidadModalBackground }
    | null;
  const returnTo = locationState?.returnTo ?? "/crm/oportunidades";
  const panelChange = locationState?.panelChange;
  const background = locationState?.background;

  const { data: oportunidad, isLoading } = useGetOne(
    "crm/oportunidades",
    { id: oportunidadId },
    { enabled: Number.isFinite(oportunidadId) },
  );
  const { data: monedas = [] } = useGetList("monedas", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "codigo", order: "ASC" },
  });
  const arsId = useMemo(() => {
    const ars = (monedas as any[]).find(
      (moneda) => String(moneda?.codigo ?? "").toUpperCase() === "ARS",
    );
    return ars?.id ? Number(ars.id) : undefined;
  }, [monedas]);

  const defaultValues = useMemo(
    () => ({
      propiedad_id: oportunidad?.propiedad_id ?? "",
      tipo_propiedad_id: oportunidad?.tipo_propiedad_id ?? "",
      moneda_id: oportunidad?.moneda_id ?? "",
      condicion_pago_id: oportunidad?.condicion_pago_id ?? "",
      monto: oportunidad?.monto ?? "",
      forma_pago_descripcion: oportunidad?.forma_pago_descripcion ?? "",
      descripcion_estado: oportunidad?.descripcion_estado ?? "",
    }),
    [oportunidad],
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  return (
    <AccionReservarContent
      returnTo={returnTo}
      oportunidadId={oportunidadId}
      oportunidad={oportunidad ?? null}
      defaultValues={defaultValues}
      arsId={arsId}
      panelChange={panelChange}
      background={background}
      dataProvider={dataProvider}
      notify={notify}
      refresh={refresh}
      navigate={navigate}
      usuarioId={Number(identity?.id) || 1}
    />
  );
};

export default CRMOportunidadAccionReservar;

const AccionReservarContent = ({
  returnTo,
  oportunidadId,
  oportunidad,
  defaultValues,
  arsId,
  panelChange,
  background,
  dataProvider,
  notify,
  refresh,
  navigate,
  usuarioId,
}: {
  returnTo: string;
  oportunidadId: number;
  oportunidad: CRMOportunidad | null;
  defaultValues: Record<string, unknown>;
  arsId?: number;
  panelChange?: PanelChange;
  background?: OportunidadModalBackground;
  dataProvider: ReturnType<typeof useDataProvider>;
  notify: ReturnType<typeof useNotify>;
  refresh: ReturnType<typeof useRefresh>;
  navigate: ReturnType<typeof useNavigate>;
  usuarioId: number;
}) => {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!oportunidadId) return;
    const descripcion = String(values.descripcion_estado ?? "").trim();
    if (!descripcion) {
      notify("La descripcion es obligatoria", { type: "warning" });
      return;
    }
    try {
      setSaving(true);
      const monto = normalizeNumber(values.monto);
      const monedaId = normalizeId(values.moneda_id);
      const condicionPagoId = normalizeId(values.condicion_pago_id);
      await dataProvider.update("crm/oportunidades", {
        id: oportunidadId,
        data: {
          propiedad_id: normalizeId(values.propiedad_id),
          tipo_propiedad_id: normalizeId(values.tipo_propiedad_id),
          moneda_id: monedaId,
          condicion_pago_id: condicionPagoId,
          monto,
          forma_pago_descripcion: String(values.forma_pago_descripcion ?? "").trim() || null,
        },
        previousData: oportunidad ?? undefined,
      });

      await dataProvider.create(`crm/oportunidades/${oportunidadId}/cambiar-estado`, {
        data: {
          nuevo_estado: "4-reserva",
          descripcion,
          usuario_id: usuarioId,
          fecha_estado: new Date().toISOString(),
          ...(monto != null ? { monto } : {}),
          ...(monedaId ? { moneda_id: monedaId } : {}),
          ...(condicionPagoId ? { condicion_pago_id: condicionPagoId } : {}),
        },
      });

      notify("Reserva registrada exitosamente", { type: "success" });
      refresh();
      navigate(returnTo, {
        replace: true,
        state: panelChange ? { panelChange } : undefined,
      });
    } catch (error) {
      console.error(error);
      notify("No se pudo registrar la reserva", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-full">
      {renderOportunidadModalBackground(background)}
      <Dialog open onOpenChange={(open) => (!open ? navigate(returnTo, { replace: true }) : null)}>
        <DialogContent
          className="sm:max-w-sm"
          overlayClassName="hidden"
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" />
            Reservar oportunidad
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            Completa los datos de la reserva.
          </DialogDescription>
        </DialogHeader>
        <SimpleForm
          className="w-full"
          key={oportunidadId}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          toolbar={null}
        >
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={oportunidad} compact />
            <SectionBaseTemplate
              title="Reserva"
              defaultOpen
              main={
                <div className="grid gap-2 md:grid-cols-12">
                  <MonedaDefaultSync arsId={arsId} />
                  <FormReferenceAutocomplete
                    referenceProps={{
                      source: "propiedad_id",
                      reference: "propiedades",
                      filter: { estado: "3-disponible" },
                    }}
                    inputProps={{
                      optionText: "nombre",
                      label: "Propiedad",
                      validate: required(),
                    }}
                    widthClass="w-full md:col-span-6"
                  />
                  <ReferenceInput
                    source="tipo_propiedad_id"
                    reference="tipos-propiedad"
                    label="Tipo de propiedad"
                  >
                    <FormSelect
                      optionText="nombre"
                      emptyText="Sin asignar"
                      widthClass="w-full"
                      triggerProps={{ className: "w-full min-w-0" }}
                    />
                  </ReferenceInput>
                  <div className="grid grid-cols-2 gap-2 md:col-span-12">
                    <div className="flex items-end">
                    <ReferenceInput source="moneda_id" reference="monedas" label="Moneda">
                      <FormSelect
                        optionText={(record) =>
                          record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre
                        }
                        emptyText="ARS"
                        validate={required()}
                        widthClass="w-[40px]"
                        triggerProps={{ className: "w-full min-w-0" }}
                      />
                    </ReferenceInput>
                    </div>
                    <FormNumber
                      source="monto"
                      label="Monto"
                      widthClass="w-full"
                      step="any"
                      validate={required()}
                    />
                  </div>
                  <ReferenceInput
                    source="condicion_pago_id"
                    reference="crm/catalogos/condiciones-pago"
                    label="Condicion de pago"
                  >
                    <FormSelect
                      optionText="nombre"
                      emptyText="Sin asignar"
                      validate={required()}
                      widthClass="w-full"
                      triggerProps={{ className: "w-full min-w-0" }}
                    />
                  </ReferenceInput>
                  <FormTextarea
                    source="descripcion_estado"
                    label="Descripcion"
                    validate={required()}
                    widthClass="w-full md:col-span-12"
                    className="[&_textarea]:min-h-[64px]"
                    placeholder="Notas adicionales para la reserva"
                  />
                  <FormTextarea
                    source="forma_pago_descripcion"
                    label="Detalle forma de pago"
                    widthClass="w-full md:col-span-12"
                    className="[&_textarea]:min-h-[64px]"
                    placeholder="Notas adicionales"
                  />
                </div>
              }
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(returnTo, { replace: true })}
              disabled={saving}
              className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm">
              {saving ? "Guardando..." : "Guardar y avanzar"}
            </Button>
          </DialogFooter>
        </SimpleForm>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MonedaDefaultSync = ({ arsId }: { arsId?: number }) => {
  const { setValue } = useFormContext();
  const monedaValue = useWatch({ name: "moneda_id" }) as unknown;

  useEffect(() => {
    if (!arsId) return;
    const current = resolveNumericId(monedaValue);
    if (current) return;
    setValue("moneda_id", arsId, { shouldDirty: false });
  }, [arsId, monedaValue, setValue]);

  return null;
};


