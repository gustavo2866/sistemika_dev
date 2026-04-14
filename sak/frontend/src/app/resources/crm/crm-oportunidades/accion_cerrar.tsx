"use client";

import { CheckCircle2, Target, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  FormReferenceAutocomplete,
  FormSelect,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CRMOportunidad } from "./model";
import { isMantenimientoOportunidad } from "./model";
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

const getResultadoChoices = (estado?: CRMOportunidad["estado"] | null) => {
  if (estado === "3-cotiza" || estado === "4-reserva") {
    return [
      { id: "ganada", name: "Ganada" },
      { id: "perdida", name: "Perdida" },
    ];
  }

  return [{ id: "perdida", name: "Perdida" }];
};

const resolveMotivoOtroId = (motivos: Array<{ id?: unknown; codigo?: string | null; nombre?: string | null }>) => {
  const found = motivos.find((motivo) =>
    `${motivo?.codigo ?? ""} ${motivo?.nombre ?? ""}`.toLowerCase().includes("otro"),
  );
  return normalizeId(found?.id) ?? "";
};

export const CRMOportunidadAccionCerrar = () => {
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
  const isMantenimiento = isMantenimientoOportunidad(oportunidad);
  const { data: motivosPerdida = [] } = useGetList(
    "crm/catalogos/motivos-perdida",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "nombre", order: "ASC" },
      filter: { activo: true },
    },
    { enabled: isMantenimiento },
  );
  const motivoOtroId = useMemo(
    () => resolveMotivoOtroId(motivosPerdida as Array<{ id?: unknown; codigo?: string | null; nombre?: string | null }>),
    [motivosPerdida],
  );
  const resultadoChoices = useMemo(
    () =>
      isMantenimiento
        ? [{ id: "ganada", name: "Ganada" }]
        : getResultadoChoices(oportunidad?.estado),
    [isMantenimiento, oportunidad?.estado],
  );

  const defaultValues = useMemo(
    () => ({
      resultado: isMantenimiento ? "ganada" : (resultadoChoices[0]?.id ?? "perdida"),
      motivo_perdida_id: isMantenimiento
        ? motivoOtroId
        : (oportunidad?.motivo_perdida_id ?? ""),
      descripcion_estado: oportunidad?.descripcion_estado ?? "",
    }),
    [isMantenimiento, motivoOtroId, oportunidad, resultadoChoices],
  );

  if (!Number.isFinite(oportunidadId) || isLoading) {
    return null;
  }

  return (
    <AccionCerrarContent
      returnTo={returnTo}
      oportunidadId={oportunidadId}
      oportunidad={oportunidad ?? null}
      defaultValues={defaultValues}
      resultadoChoices={resultadoChoices}
      isMantenimiento={isMantenimiento}
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

export default CRMOportunidadAccionCerrar;

const AccionCerrarContent = ({
  returnTo,
  oportunidadId,
  oportunidad,
  defaultValues,
  resultadoChoices,
  isMantenimiento,
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
  resultadoChoices: Array<{ id: string; name: string }>;
  isMantenimiento: boolean;
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
    const motivoPerdidaId = normalizeId(values.motivo_perdida_id);
    const resultado = isMantenimiento
      ? "ganada"
      : String(values.resultado ?? "perdida");
    const nuevoEstado = resultado === "ganada" ? "5-ganada" : "6-perdida";
    const canCloseAsGanada =
      isMantenimiento ||
      oportunidad?.estado === "3-cotiza" ||
      oportunidad?.estado === "4-reserva";
    if (!descripcion) {
      notify("La descripcion es obligatoria", { type: "warning" });
      return;
    }
    if (nuevoEstado === "6-perdida" && !motivoPerdidaId) {
      notify("El motivo de perdida es obligatorio", { type: "warning" });
      return;
    }
    if (nuevoEstado === "5-ganada" && !canCloseAsGanada) {
      notify(
        "Solo oportunidades en Cotiza o Reserva pueden cerrarse como ganadas.",
        { type: "warning" },
      );
      return;
    }
    try {
      setSaving(true);
      const monto = oportunidad?.monto ?? null;
      const monedaId = normalizeId(oportunidad?.moneda_id);
      const condicionPagoId = normalizeId(oportunidad?.condicion_pago_id);

      if (
        !isMantenimiento &&
        nuevoEstado === "5-ganada" &&
        (monto == null || !monedaId || !condicionPagoId)
      ) {
        notify(
          "Para cerrar como ganada la oportunidad debe tener monto, moneda y condicion de pago.",
          { type: "warning" },
        );
        return;
      }

      await dataProvider.create(`crm/oportunidades/${oportunidadId}/cambiar-estado`, {
        data: {
          nuevo_estado: nuevoEstado,
          descripcion,
          usuario_id: usuarioId,
          fecha_estado: new Date().toISOString(),
          ...(nuevoEstado === "5-ganada" && !isMantenimiento
            ? {
                monto,
                moneda_id: monedaId,
                condicion_pago_id: condicionPagoId,
              }
            : {}),
          ...(nuevoEstado === "6-perdida" ? { motivo_perdida_id: motivoPerdidaId } : {}),
        },
      });
      notify(
        nuevoEstado === "6-perdida"
          ? "Oportunidad cerrada como perdida"
          : "Oportunidad marcada como ganada",
        { type: "success" },
      );
      refresh();
      navigate(returnTo, {
        replace: true,
        state: panelChange ? { panelChange } : undefined,
      });
    } catch (error) {
      console.error(error);
      notify("No se pudo cerrar la oportunidad", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-full">
      {renderOportunidadModalBackground(background)}
      <Dialog open onOpenChange={(open) => (!open ? navigate(returnTo) : null)}>
        <DialogContent
          className="sm:max-w-sm"
          overlayClassName="hidden"
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Cerrar oportunidad
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs">
            {isMantenimiento
              ? "Ingresa el comentario de cierre."
              : "Completa el motivo y notas de cierre."}
          </DialogDescription>
        </DialogHeader>
        <SimpleForm
          className="w-full"
          key={`${oportunidadId}-${isMantenimiento ? `mantenimiento-${String(defaultValues.motivo_perdida_id ?? "")}` : "general"}`}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          toolbar={null}
        >
          <div className="space-y-3">
            <AccionOportunidadHeader oportunidad={oportunidad} compact />
            <SectionBaseTemplate
              title="Cierre"
              defaultOpen
              main={
                <AccionCerrarFields
                  resultadoChoices={resultadoChoices}
                  isMantenimiento={isMantenimiento}
                />
              }
            />
          </div>
          <AccionCerrarFooter
            saving={saving}
            returnTo={returnTo}
            navigate={navigate}
          />
        </SimpleForm>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AccionCerrarFooter = ({
  saving,
  returnTo,
  navigate,
}: {
  saving: boolean;
  returnTo: string;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const resultadoValue = useWatch({ name: "resultado" }) as string | undefined;
  const isGanada = resultadoValue === "ganada";
  const actionIcon = isGanada ? (
    <CheckCircle2 className="h-3.5 w-3.5" />
  ) : (
    <XCircle className="h-3.5 w-3.5" />
  );

  return (
    <DialogFooter className="mt-4 gap-2 sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => navigate(returnTo)}
        disabled={saving}
        className="h-8 min-w-[96px] px-3 text-[11px] sm:h-8 sm:text-[11px]"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={saving}
        className={cn(
          "h-8 min-w-[96px] px-3 text-[11px] text-white sm:h-8 sm:text-[11px]",
          isGanada
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-rose-600 hover:bg-rose-700",
        )}
      >
        {actionIcon}
        {saving ? "Cerrando..." : "Cerrar"}
      </Button>
    </DialogFooter>
  );
};

const AccionCerrarFields = ({
  resultadoChoices,
  isMantenimiento,
}: {
  resultadoChoices: Array<{ id: string; name: string }>;
  isMantenimiento: boolean;
}) => {
  const resultadoValue = useWatch({ name: "resultado" }) as string | undefined;
  const isGanada = resultadoValue === "ganada";
  const isPerdida = (resultadoValue ?? "perdida") === "perdida";

  return (
    <div className="grid gap-2 md:grid-cols-12">
      {isMantenimiento ? (
        <>
          <HiddenInput source="resultado" />
          <HiddenInput source="motivo_perdida_id" />
        </>
      ) : null}
      {!isMantenimiento ? (
        <FormSelect
          source="resultado"
          label="Resultado"
          optionText="name"
          optionValue="id"
          choices={resultadoChoices}
          validate={required()}
          widthClass="w-full md:col-span-6"
          triggerProps={{
            className: cn(
              "transition-colors [&_[data-slot=select-value]]:font-medium",
              isGanada
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:border-emerald-500 focus-visible:ring-emerald-200 [&_[data-slot=select-value]]:text-emerald-700 [&_svg]:text-emerald-600"
                : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:border-rose-500 focus-visible:ring-rose-200 [&_[data-slot=select-value]]:text-rose-700 [&_svg]:text-rose-600",
            ),
          }}
        />
      ) : null}
      {!isMantenimiento && isPerdida ? (
        <FormReferenceAutocomplete
          referenceProps={{
            source: "motivo_perdida_id",
            reference: "crm/catalogos/motivos-perdida",
          }}
          inputProps={{
            optionText: "nombre",
            label: "Motivo",
            validate: required(),
          }}
          widthClass="w-full md:col-span-6"
        />
      ) : null}
      <FormTextarea
        source="descripcion_estado"
        label={isMantenimiento ? "Comentario" : "Notas"}
        validate={required()}
        widthClass="w-full md:col-span-12"
        className="[&_textarea]:min-h-[64px]"
      />
    </div>
  );
};

