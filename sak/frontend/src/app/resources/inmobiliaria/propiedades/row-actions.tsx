"use client";

import { useMemo, useState } from "react";
import { useGetList, useGetOne, useRecordContext } from "ra-core";
import { Workflow } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import {
  FormOrderListRowActions,
  useRowActionDialog,
} from "@/components/forms/form_order";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

import type { Propiedad } from "./model";
import { isTipoOperacionAlquiler } from "./model";
import {
  FormStatus,
  FormStatusContent,
  getStatusRestriction,
  type FormStatusValues,
} from "./form_status";
import { usePropiedadStatusTransition } from "./form_hooks";
import { FormActualizar } from "./form_actualizar";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import {
  PROPIEDAD_STATUS_IDS,
  getAllowedPropiedadStatusTargets,
} from "./status_transitions";

type PropiedadActionRecord = Propiedad & {
  estado?: string | null;
};

const normalizeStatusLabel = (value?: string | null) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const resolvePropiedadStatusId = (record?: PropiedadActionRecord | null) => {
  if (record?.propiedad_status_id) return record.propiedad_status_id;

  const label = normalizeStatusLabel(record?.propiedad_status?.nombre ?? record?.estado);
  if (!label) return null;
  if (label.includes("recib")) return PROPIEDAD_STATUS_IDS.recibida;
  if (label.includes("repar")) return PROPIEDAD_STATUS_IDS.enReparacion;
  if (label.includes("dispon")) return PROPIEDAD_STATUS_IDS.disponible;
  if (label.includes("realiz") || label.includes("alquil")) return PROPIEDAD_STATUS_IDS.realizada;
  if (label.includes("retir")) return PROPIEDAD_STATUS_IDS.retirada;
  return null;
};

export const useCanDeletePropiedad = (record?: PropiedadActionRecord | null) => {
  const resolvedStatusId = resolvePropiedadStatusId(record);
  const { total: estadosLogTotal } = useGetList(
    "propiedades-log-status",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "fecha_cambio", order: "DESC" },
      filter: { propiedad_id: record?.id },
    },
    { enabled: Boolean(record?.id) },
  );

  return (
    Boolean(record?.id) &&
    resolvedStatusId === PROPIEDAD_STATUS_IDS.recibida &&
    estadosLogTotal === 1
  );
};

export const PropiedadRowActions = ({
  refreshEventName,
  className,
}: {
  refreshEventName?: string;
  className?: string;
}) => {
  const record = useRecordContext<PropiedadActionRecord>();
  const canDeletePropiedad = useCanDeletePropiedad(record);

  return (
    <FormOrderListRowActions
      showShow={false}
      showDelete={canDeletePropiedad}
      className={className}
      refreshEventName={refreshEventName}
      extraMenuItems={
        <>
          <PropiedadStatusMenu />
          <FormActualizar refreshEventName={refreshEventName} />
        </>
      }
    />
  );
};

export const PropiedadStatusMenu = () => {
  const record = useRecordContext<PropiedadActionRecord>();
  const dialog = useRowActionDialog();
  const { cambiarEstado, loading } = usePropiedadStatusTransition();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const form = useForm<FormStatusValues>({
    defaultValues: { fecha_cambio: today, comentario: "" },
    mode: "onChange",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nextStatusId, setNextStatusId] = useState<number | null>(null);

  const normalizedRecord = useMemo(() => {
    if (!record?.id) return null;
    const propiedadStatusId = resolvePropiedadStatusId(record);
    const propiedadStatusName =
      record.propiedad_status?.nombre ?? (record.estado ? String(record.estado) : undefined);

    return {
      ...record,
      propiedad_status_id: propiedadStatusId,
      propiedad_status:
        record.propiedad_status ??
        (propiedadStatusId && propiedadStatusName
          ? { id: propiedadStatusId, nombre: propiedadStatusName }
          : null),
    } satisfies PropiedadActionRecord;
  }, [record]);

  const allowedTargets = useMemo(
    () => getAllowedPropiedadStatusTargets(normalizedRecord?.propiedad_status_id ?? null),
    [normalizedRecord?.propiedad_status_id],
  );
  const tipoOperacionId = normalizedRecord?.tipo_operacion_id ?? null;
  const { data: tipoOperacion } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: tipoOperacionId ?? 0 },
    {
      enabled:
        Boolean(tipoOperacionId) &&
        !normalizedRecord?.tipo_operacion?.nombre &&
        !("codigo" in ((normalizedRecord?.tipo_operacion as Record<string, unknown> | null) ?? {})),
    },
  );
  const tipoOperacionRef =
    normalizedRecord?.tipo_operacion ??
    ((tipoOperacion as { nombre?: string | null; codigo?: string | null } | undefined) ?? null);
  const isAlquiler = isTipoOperacionAlquiler(tipoOperacionRef ?? undefined);
  const filteredTargets = useMemo(() => {
    if (
      isAlquiler &&
      normalizedRecord?.propiedad_status_id === PROPIEDAD_STATUS_IDS.realizada
    ) {
      return allowedTargets.filter((option) => option.id !== PROPIEDAD_STATUS_IDS.retirada);
    }
    return allowedTargets;
  }, [allowedTargets, isAlquiler, normalizedRecord?.propiedad_status_id]);
  const getRestrictionMessage = (statusId: number) => {
    if (!normalizedRecord) return null;
    return getStatusRestriction({
      isAlquiler,
      record: normalizedRecord,
      nextStatusId: statusId,
    });
  };

  if (!normalizedRecord?.id || filteredTargets.length === 0) return null;

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setNextStatusId(null);
  };

  const handleDialogConfirm = (statusId: number) =>
    form.handleSubmit(async (values) => {
      if (loading) return;
      if (getRestrictionMessage(statusId)) return;
      await cambiarEstado({
        record: normalizedRecord,
        nextStatusId: statusId,
        fechaCambio: values.fecha_cambio,
        comentario: values.comentario,
      });
    })();

  const openDialogWithForm = (statusId: number) => {
    form.reset({ fecha_cambio: today, comentario: "" });
    const restrictionMessage = getRestrictionMessage(statusId);
    if (dialog) {
      dialog.openDialog({
        title: "Cambiar estado",
        contentClassName: "sm:max-w-[420px]",
        overlayClassName: PROPIEDAD_DIALOG_OVERLAY_CLASS,
        content: (
          <FormProvider {...form}>
            <FormStatusContent record={normalizedRecord} nextStatusId={statusId} />
          </FormProvider>
        ),
        confirmLabel: "Confirmar",
        confirmColor: "primary",
        confirmDisabled: Boolean(restrictionMessage),
        onConfirm: () => handleDialogConfirm(statusId),
      });
      return;
    }
    setNextStatusId(statusId);
    setDialogOpen(true);
  };

  const handleOpenDialog = (
    event: { stopPropagation: () => void },
    statusId: number,
  ) => {
    event.stopPropagation();
    openDialogWithForm(statusId);
  };

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          onClick={(event) => event.stopPropagation()}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          <Workflow className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
          Cambiar estado
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-28 sm:w-36">
          {filteredTargets.map((option) => (
            <DropdownMenuItem
              key={option.key}
              onSelect={(event) => handleOpenDialog(event, option.id)}
              onClick={(event) => event.stopPropagation()}
              data-row-click="ignore"
              className="px-1.5 py-1 text-[8px] sm:text-[10px]"
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {nextStatusId != null ? (
        <FormStatus
          open={dialogOpen}
          onOpenChange={handleOpenChange}
          record={normalizedRecord}
          nextStatusId={nextStatusId}
        />
      ) : null}
    </>
  );
};
