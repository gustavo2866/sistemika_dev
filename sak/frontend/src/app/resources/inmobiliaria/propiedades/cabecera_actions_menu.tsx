"use client";

import { useMemo } from "react";
import { useDataProvider, useNotify, useRecordContext } from "ra-core";
import { History, KeyRound, Target, Trash2 } from "lucide-react";
import { useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { useRowActionDialog } from "@/components/forms/form_order";
import { resolveNumericId } from "@/components/forms/form_order";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import type { Propiedad } from "./model";
import { FormActualizar } from "./form_actualizar";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "./dialog_styles";
import { EstadosDialogContent } from "./estados_dialog";
import { OportunidadesDialogContent } from "./oportunidades_dialog";
import { PropiedadStatusMenu, useCanDeletePropiedad } from "./row-actions";

const PROPIEDAD_FORM_DIALOG_CONTENT_CLASS = "sm:max-w-6xl";

export const CabeceraActionsMenu = ({
  onOpenPropietario,
}: {
  onOpenPropietario: () => void;
}) => {
  const record = useRecordContext<Propiedad>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useRowActionDialog();
  const showPropietarioAction = /^\/propiedades(?:\/create|\/[^/]+)?$/.test(location.pathname);
  const propiedadId = resolveNumericId(record?.id);
  const tipoOperacionValue = useWatch({ name: "tipo_operacion_id" }) as unknown;
  const tipoOperacionId = useMemo(
    () =>
      resolveNumericId(tipoOperacionValue) ??
      resolveNumericId(record?.tipo_operacion_id) ??
      null,
    [record?.tipo_operacion_id, tipoOperacionValue],
  );

  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const canDeletePropiedad = useCanDeletePropiedad(record);
  const portalContainer =
    typeof document !== "undefined"
      ? document.getElementById("propiedad-form-shell") ?? document.getElementById("admin-content")
      : null;

  const handleDelete = async () => {
    if (!record?.id) return;
    try {
      await dataProvider.delete("propiedades", {
        id: record.id,
        previousData: record,
      });
      notify("Registro eliminado", { type: "info" });
      navigate(returnTo ?? "/propiedades", { replace: true });
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar", { type: "warning" });
    }
  };

  const openEstadosDialog = () => {
    dialog?.openDialog({
      title: "Estados",
      content: <EstadosDialogContent propiedadId={propiedadId} />,
      contentClassName: PROPIEDAD_FORM_DIALOG_CONTENT_CLASS,
      overlayClassName: PROPIEDAD_DIALOG_OVERLAY_CLASS,
      portalContainer,
      contained: true,
      onConfirm: () => undefined,
      confirmLabel: "Cerrar",
    });
  };

  const openOportunidadesDialog = () => {
    dialog?.openDialog({
      title: "Oportunidades",
      content: (
        <OportunidadesDialogContent
          propiedadId={propiedadId}
          tipoOperacionId={tipoOperacionId}
        />
      ),
      contentClassName: PROPIEDAD_FORM_DIALOG_CONTENT_CLASS,
      overlayClassName: PROPIEDAD_DIALOG_OVERLAY_CLASS,
      portalContainer,
      contained: true,
      onConfirm: () => undefined,
      confirmLabel: "Cerrar",
    });
  };

  return (
    <>
      {canDeletePropiedad ? (
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            dialog?.openDialog({
              title: "Eliminar propiedad",
              content: "Seguro que deseas eliminar esta propiedad?",
              confirmLabel: "Eliminar",
              confirmColor: "warning",
              overlayClassName: PROPIEDAD_DIALOG_OVERLAY_CLASS,
              onConfirm: handleDelete,
            });
          }}
          onClick={(event) => event.stopPropagation()}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          variant="destructive"
        >
          <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
          Eliminar
        </DropdownMenuItem>
      ) : null}
      {canDeletePropiedad ? <DropdownMenuSeparator /> : null}
      {record?.id ? <PropiedadStatusMenu /> : null}
      {record?.id ? <FormActualizar /> : null}
      {record?.id ? (
        <DropdownMenuItem
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          onSelect={(event) => {
            event.stopPropagation();
            openEstadosDialog();
          }}
        >
          <History className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
          Estados
        </DropdownMenuItem>
      ) : null}
      {record?.id ? (
        <DropdownMenuItem
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          onSelect={(event) => {
            event.stopPropagation();
            openOportunidadesDialog();
          }}
        >
          <Target className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
          Oportunidades
        </DropdownMenuItem>
      ) : null}
      {showPropietarioAction && record?.id ? <DropdownMenuSeparator /> : null}
      {showPropietarioAction ? (
        <DropdownMenuItem
          onSelect={(event) => {
            event.stopPropagation();
            onOpenPropietario();
          }}
          onClick={(event) => event.stopPropagation()}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          <KeyRound className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
          Propietario +
        </DropdownMenuItem>
      ) : null}
    </>
  );
};
