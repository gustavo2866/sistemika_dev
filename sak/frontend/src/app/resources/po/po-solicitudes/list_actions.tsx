"use client";

import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CheckCircle2, Eye, MoreHorizontal, Pencil, Trash2, XCircle } from "lucide-react";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PoSolicitud } from "./model";

export const ListRowActions = () => {
  const record = useRecordContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "approve" | "reject" | "delete" | null
  >(null);

  if (!record || !resource) {
    return null;
  }

  const canApprove = record.estado === "emitida";
  const canReject = record.estado === "emitida";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleStatusChange = async (estado: "aprobada" | "rechazada") => {
    if (!record?.id) {
      return;
    }
    setBusyAction(estado);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const response = await fetch(
        `${apiBaseUrl}/po-solicitudes/${record.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ estado }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      notify(
        `Solicitud PO ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
        { type: "info" }
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id, previousData: record });
      notify("Solicitud PO eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la solicitud PO", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const stopRowClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMenuAction = (event: React.MouseEvent, callback: () => void) => {
    stopRowClick(event);
    if (busyAction !== null) {
      return;
    }
    callback();
  };

  const openConfirm = (action: "approve" | "reject" | "delete") => {
    if (busyAction !== null) return;
    setConfirmAction(action);
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmTitle = {
    approve: "Aprobar solicitud",
    reject: "Rechazar solicitud",
    delete: "Eliminar solicitud",
  }[confirmAction ?? "approve"];

  const confirmContent = {
    approve: "Seguro que deseas aprobar la solicitud?",
    reject: "Seguro que deseas rechazar la solicitud?",
    delete: "Seguro que deseas eliminar la solicitud?",
  }[confirmAction ?? "approve"];

  const handleConfirm = () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    if (action === "delete") {
      handleDelete();
      return;
    }
    handleStatusChange(action === "approve" ? "aprobada" : "rechazada");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busyAction !== null}
            onClick={stopRowClick}
            data-row-click="ignore"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 sm:w-44 text-[10px] sm:text-xs">
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => redirect("edit", resource, record.id))
            }
            disabled={busyAction !== null}
          >
            <Pencil className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => redirect("show", resource, record.id))
            }
            disabled={busyAction !== null}
          >
            <Eye className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => handleMenuAction(event, () => openConfirm("delete"))}
            disabled={busyAction !== null}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Eliminar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canApprove && (
            <DropdownMenuItem
              onClick={(event) =>
                handleMenuAction(event, () => openConfirm("approve"))
              }
              disabled={!canApprove || busyAction !== null}
            >
              <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Aprobar
            </DropdownMenuItem>
          )}
          {canReject && (
            <DropdownMenuItem
              onClick={(event) =>
                handleMenuAction(event, () => openConfirm("reject"))
              }
              disabled={!canReject || busyAction !== null}
            >
              <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Rechazar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmAction !== null}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmTitle}
        content={confirmContent}
        confirmColor={confirmAction === "delete" ? "warning" : "primary"}
        loading={busyAction !== null}
      />
    </>
  );
};
