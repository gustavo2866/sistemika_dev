"use client";

import { useMemo, useState } from "react";
import { useDataProvider, useGetOne, useNotify, useRecordContext, useRefresh } from "ra-core";
import { CalendarPlus } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import { useRowActionDialog } from "@/components/forms/form_order";

type TipoActualizacionData = {
  id: number;
  nombre?: string | null;
  cantidad_meses?: number | null;
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
  if (!value) return null;
  return value.toISOString().slice(0, 10);
};

export const FormRenovar = ({ disabled }: { disabled?: boolean }) => {
  const record = useRecordContext<any>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const dialog = useRowActionDialog();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const tipoActualizacionId = record?.tipo_actualizacion_id;
  const { data: tipoActualizacion } = useGetOne<TipoActualizacionData>(
    "tipos-actualizacion",
    { id: tipoActualizacionId ?? 0 },
    { enabled: Boolean(tipoActualizacionId) },
  );

  const baseDate = parseDate(record?.fecha_renovacion) ?? parseDate(record?.fecha_inicio_contrato);
  const cantidadMeses = Number(tipoActualizacion?.cantidad_meses ?? 0);
  const canCalculate = Boolean(baseDate && cantidadMeses > 0);
  const nuevaRenovacion = useMemo(
    () => (canCalculate && baseDate ? addMonths(baseDate, cantidadMeses) : null),
    [baseDate, cantidadMeses, canCalculate],
  );

  if (!record?.id) return null;

  const tipoActualizacionLabel =
    tipoActualizacion?.nombre ??
    (tipoActualizacionId ? `#${tipoActualizacionId}` : "Sin tipo");

  const confirmContent = (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>Se actualizará la fecha de próxima renovación.</p>
      <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Propiedad:</span>{" "}
          {record?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Tipo propiedad:</span>{" "}
          {record?.tipo_propiedad?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Tipo operacion:</span>{" "}
          {record?.tipo_operacion?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Estado:</span>{" "}
          {record?.propiedad_status?.nombre ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Tipo actualizacion:</span>{" "}
          {tipoActualizacionLabel}
        </div>
        <div>
          <span className="font-semibold text-foreground">Fecha renovacion:</span>{" "}
          {formatDate(parseDate(record?.fecha_renovacion))}
        </div>
        <div>
          <span className="font-semibold text-foreground">Fecha renovacion nueva:</span>{" "}
          {formatDate(nuevaRenovacion)}
        </div>
        {!canCalculate ? (
          <div className="pt-2 text-[10px] text-amber-700">
            Falta fecha base o cantidad de meses para calcular la renovacion.
          </div>
        ) : null}
      </div>
    </div>
  );

  const runConfirm = async () => {
    if (!record?.id) return;
    if (!canCalculate || !nuevaRenovacion) {
      notify("No se pudo calcular la fecha de renovacion", { type: "warning" });
      return;
    }
    setLoading(true);
    try {
      await dataProvider.update("propiedades", {
        id: record.id,
        data: { fecha_renovacion: formatIsoDate(nuevaRenovacion) },
        previousData: record,
      });
      notify("Renovacion actualizada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la renovacion", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    await runConfirm();
    setOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.stopPropagation();
          if (disabled || loading) return;
          if (dialog) {
            dialog.openDialog({
              title: "Renovar contrato",
              content: confirmContent,
              confirmLabel: "Renovar",
              confirmColor: "primary",
              onConfirm: runConfirm,
            });
            return;
          }
          setOpen(true);
        }}
        onClick={(event) => event.stopPropagation()}
        disabled={disabled || loading}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <CalendarPlus className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Renovar
      </DropdownMenuItem>
      {!dialog ? (
        <Confirm
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          title="Renovar contrato"
          content={confirmContent}
          confirm="Renovar"
          confirmColor="primary"
          loading={loading}
        />
      ) : null}
    </>
  );
};
