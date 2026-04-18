"use client";

import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { CalendarPlus } from "lucide-react";
import { required, useGetList, useGetOne, useNotify, useRecordContext, useRefresh } from "ra-core";

import {
  FormDate,
  FormNumber,
  FormValue,
  SectionBaseTemplate,
  useRowActionDialog,
} from "@/components/forms/form_order";
import { FormDialog } from "@/components/forms/form-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/dataProvider";

import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import { getPropiedadStatusLabel } from "./status_transitions";

type TipoActualizacionData = {
  id: number;
  nombre?: string | null;
  cantidad_meses?: number | null;
};

type ContratoVigenteData = {
  id: number;
  estado?: string | null;
  fecha_inicio?: string | null;
  fecha_renovacion?: string | null;
  valor_alquiler?: number | null;
  moneda?: string | null;
  tipo_actualizacion_id?: number | null;
};

type ActualizarContratoValues = {
  fecha_renovacion: string;
  valor_alquiler: number | null;
};

const addMonths = (base: Date, months: number) => {
  const baseYear = base.getFullYear();
  const baseMonth = base.getMonth();
  const baseDay = base.getDate();
  const targetMonth = baseMonth + months;
  const year = baseYear + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(baseDay, daysInMonth);
  return new Date(year, month, day);
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (value?: Date | null) => {
  if (!value) return "-";
  return value.toLocaleDateString("es-AR");
};

const formatIsoDate = (value?: Date | null) => {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
};

const formatMoney = (value?: number | null, currency = "ARS") => {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString("es-AR");
  }
};

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const extractErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  return (
    data?.detail?.error?.message ??
    data?.detail?.message ??
    data?.detail ??
    "No se pudo actualizar el contrato"
  );
};

const ActualizarContratoContent = ({
  record,
  tipoActualizacionLabel,
  estadoLabel,
  moneda,
  contratoVigenteId,
  fechaActualizacionActual,
  valorActual,
}: {
  record: any;
  tipoActualizacionLabel: string;
  estadoLabel: string;
  moneda: string;
  contratoVigenteId?: number;
  fechaActualizacionActual?: Date | null;
  valorActual?: number | null;
}) => (
  <div className="w-full max-w-[420px] mx-auto space-y-3">
    <SectionBaseTemplate
      title="Resumen"
      defaultOpen
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormValue label="Propiedad" widthClass="w-full" valueClassName="justify-start text-left">
            {record?.nombre ?? "-"}
          </FormValue>
          <FormValue label="Contrato vigente" widthClass="w-full sm:w-[140px]">
            {contratoVigenteId ? `#${contratoVigenteId}` : "No encontrado"}
          </FormValue>
          <FormValue label="Estado" widthClass="w-full" valueClassName="justify-start text-left">
            {estadoLabel}
          </FormValue>
          <FormValue label="Tipo actualizacion" widthClass="w-full" valueClassName="justify-start text-left">
            {tipoActualizacionLabel}
          </FormValue>
          <FormValue label="Fecha actualizacion actual" widthClass="w-full">
            {formatDate(fechaActualizacionActual)}
          </FormValue>
          <FormValue label="Valor alquiler actual" widthClass="w-full" valueClassName="justify-start text-left">
            {formatMoney(valorActual, moneda)}
          </FormValue>
        </div>
      }
    />
    <SectionBaseTemplate
      title="Actualizar"
      defaultOpen
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormDate
            source="fecha_renovacion"
            label="Fecha de proxima actualizacion"
            widthClass="w-full"
            validate={required()}
          />
          <FormNumber
            source="valor_alquiler"
            label="Nuevo valor alquiler"
            widthClass="w-full"
            min={0}
            step="any"
            validate={required()}
          />
        </div>
      }
    />
  </div>
);

export const FormActualizar = ({
  disabled,
  refreshEventName,
}: {
  disabled?: boolean;
  refreshEventName?: string;
}) => {
  const record = useRecordContext<any>();
  const notify = useNotify();
  const refresh = useRefresh();
  const dialog = useRowActionDialog();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<ActualizarContratoValues>({
    defaultValues: {
      fecha_renovacion: "",
      valor_alquiler: null,
    },
    mode: "onChange",
  });

  const { data: contratosVigentes = [], isLoading: loadingContratoVigente } = useGetList<ContratoVigenteData>(
    "contratos",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "DESC" },
      filter: { propiedad_id: record?.id, estado: "vigente" },
    },
    { enabled: Boolean(record?.id) },
  );

  const contratoVigente = contratosVigentes[0];
  const tipoActualizacionId =
    contratoVigente?.tipo_actualizacion_id ?? record?.tipo_actualizacion_id;
  const { data: tipoActualizacion } = useGetOne<TipoActualizacionData>(
    "tipos-actualizacion",
    { id: tipoActualizacionId ?? 0 },
    { enabled: Boolean(tipoActualizacionId) },
  );

  const baseDate =
    parseDate(contratoVigente?.fecha_renovacion) ?? parseDate(contratoVigente?.fecha_inicio);
  const cantidadMeses = Number(tipoActualizacion?.cantidad_meses ?? 0);
  const suggestedFechaActualizacion = useMemo(() => {
    if (baseDate && cantidadMeses > 0) {
      return addMonths(baseDate, cantidadMeses);
    }
    return parseDate(contratoVigente?.fecha_renovacion);
  }, [baseDate, cantidadMeses, contratoVigente?.fecha_renovacion]);

  if (!record?.id) return null;

  const tipoActualizacionLabel =
    tipoActualizacion?.nombre ??
    (tipoActualizacionId ? `#${tipoActualizacionId}` : "Sin tipo");
  const estadoLabel =
    record?.propiedad_status?.nombre ??
    (record?.estado
      ? String(record.estado)
      : record?.propiedad_status_id
        ? getPropiedadStatusLabel(record.propiedad_status_id)
        : "-");
  const moneda = contratoVigente?.moneda ?? "ARS";

  const resetForm = () => {
    form.reset({
      fecha_renovacion: formatIsoDate(suggestedFechaActualizacion),
      valor_alquiler: contratoVigente?.valor_alquiler ?? record?.valor_alquiler ?? null,
    });
  };

  const runConfirm = form.handleSubmit(async (values) => {
    if (!contratoVigente?.id) {
      notify("No hay un contrato vigente para actualizar.", { type: "warning" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/contratos/${contratoVigente.id}/actualizar-vigencia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          fecha_renovacion: values.fecha_renovacion || null,
          valor_alquiler: values.valor_alquiler,
        }),
      });

      if (!response.ok) {
        notify(await extractErrorMessage(response), { type: "warning" });
        return;
      }

      notify("Contrato actualizado", { type: "info" });
      refresh();
      if (refreshEventName && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(refreshEventName));
      }
      setOpen(false);
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el contrato", { type: "warning" });
    } finally {
      setLoading(false);
    }
  });

  const content = (
    <FormProvider {...form}>
      <ActualizarContratoContent
        record={record}
        tipoActualizacionLabel={tipoActualizacionLabel}
        estadoLabel={estadoLabel}
        moneda={moneda}
        contratoVigenteId={contratoVigente?.id}
        fechaActualizacionActual={parseDate(contratoVigente?.fecha_renovacion)}
        valorActual={contratoVigente?.valor_alquiler}
      />
    </FormProvider>
  );

  const openEditor = () => {
    if (disabled || loading || loadingContratoVigente) return;
    if (!contratoVigente?.id) {
      notify("No hay un contrato vigente para actualizar.", { type: "warning" });
      return;
    }
    resetForm();
    if (dialog) {
      dialog.openDialog({
        title: "Actualizar",
        content,
        confirmLabel: "Actualizar",
        confirmColor: "primary",
        contentClassName: "sm:max-w-[460px]",
        overlayClassName: PROPIEDAD_DIALOG_OVERLAY_CLASS,
        onConfirm: runConfirm,
      });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.stopPropagation();
          openEditor();
        }}
        onClick={(event) => event.stopPropagation()}
        disabled={disabled || loading || loadingContratoVigente}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <CalendarPlus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Actualizar
      </DropdownMenuItem>
      {!dialog ? (
        <FormDialog
          open={open}
          onOpenChange={(nextOpen) => (!loading ? setOpen(nextOpen) : null)}
          title="Actualizar"
          onSubmit={(event) => {
            event.preventDefault();
            void runConfirm();
          }}
          onCancel={() => setOpen(false)}
          submitLabel="Actualizar"
          isSubmitting={loading}
          submitDisabled={!form.watch("fecha_renovacion") || form.watch("valor_alquiler") == null}
          contentClassName="sm:max-w-[460px]"
          overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}
          compact
        >
          {content}
        </FormDialog>
      ) : null}
    </>
  );
};
