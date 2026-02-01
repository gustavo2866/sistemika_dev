/**
 * Acciones por fila para PoSolicitudes.
 *
 * Estructura:
 * 1. STATE - Estado interno y validaciones
 * 2. ACTIONS - Handlers de acciones de usuario
 * 3. UI - Render del menu contextual
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useDeleteWithUndoController,
  useNotify,
  useRefresh,
  useRedirect,
  useRecordContext,
  useResourceContext,
} from "ra-core";
import {
  CheckCircle2,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { PoSolicitud } from "./model";

//******************************************** */
// region 1. STATE

type PoSolicitudActionState = {
  record: PoSolicitud;
  resource: string;
  busyAction: string | null;
  setBusyAction: React.Dispatch<React.SetStateAction<string | null>>;
  canApprove: boolean;
  canReject: boolean;
  confirmDeleteOpen: boolean;
  openConfirmDelete: (event?: React.MouseEvent) => void;
  closeConfirmDelete: () => void;
  handleConfirmDelete: () => void;
};

// Normaliza record y permisos para acciones.
const usePoSolicitudActionState = () => {
  const record = useRecordContext<PoSolicitud>();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resourceContext = useResourceContext();
  const resource = resourceContext ?? "po-solicitudes";
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const permissions = useMemo(() => {
    const isEmitida = record?.estado === "emitida";
    const isApproved = record?.estado === "aprobada";
    return {
      canApprove: isEmitida,
      canReject: isApproved,
    };
  }, [record?.estado]);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const { isPending: isDeleting, handleDelete } = useDeleteWithUndoController({
    record,
    resource,
    redirect: "list",
    successMessage: "Solicitud PO eliminada",
  });

//******************************************** */
// region 2. ACTIONS

// Cambia el estado de la solicitud en el backend.
  const handleStatusChange = useCallback(
    async (estado: "aprobada" | "rechazada") => {
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
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        notify(
          `Solicitud PO ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
          { type: "info" },
        );
        refresh();
      } catch (error) {
        console.error(error);
        notify("No se pudo actualizar la solicitud PO", { type: "warning" });
      } finally {
        setBusyAction(null);
      }
    },
    [apiBaseUrl, notify, record?.id, refresh],
  );

// Evita que el click de menu dispare el rowClick.
  const stopRowClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

// Ejecuta una accion del menu respetando estado ocupado.
  const handleMenuAction = useCallback(
    (event: React.MouseEvent, callback: () => void) => {
      stopRowClick(event);
      if (busyAction !== null || isDeleting) {
        return;
      }
      callback();
    },
    [busyAction, isDeleting, stopRowClick],
  );

  if (!record || record.id == null || !resource) {
    return null;
  }

  return {
    record,
    resource,
    busyAction: busyAction ?? (isDeleting ? "delete" : null),
    setBusyAction,
    canApprove: permissions.canApprove,
    canReject: permissions.canReject,
    handleStatusChange,
    handleMenuAction,
    stopRowClick,
    notify,
    refresh,
    redirect,
    confirmDeleteOpen,
    openConfirmDelete: (event?: React.MouseEvent) => {
      if (event) {
        stopRowClick(event);
      }
      if (busyAction !== null || isDeleting) {
        return;
      }
      setConfirmDeleteOpen(true);
    },
    closeConfirmDelete: () => setConfirmDeleteOpen(false),
    handleConfirmDelete: () => {
      setConfirmDeleteOpen(false);
      handleDelete();
    },
  };
};
// endregion

//******************************************** */
// region 3. UI

// Renderiza el menu contextual con acciones.
const PoSolicitudActionsMenuList = () => {
  const state = usePoSolicitudActionState();

  if (!state) {
    return null;
  }

  const {
    record,
    resource,
    busyAction,
    canApprove,
    canReject,
    handleStatusChange,
    handleMenuAction,
    stopRowClick,
    redirect,
    confirmDeleteOpen,
    openConfirmDelete,
    closeConfirmDelete,
    handleConfirmDelete,
  } = state;

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
        <DropdownMenuContent
          align="end"
          className="w-40 sm:w-44 text-[10px] sm:text-xs"
          data-row-click="ignore"
        >
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
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => handleMenuAction(event, openConfirmDelete)}
            disabled={busyAction !== null}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Eliminar
          </DropdownMenuItem>
          {(canApprove || canReject) && busyAction === null ? (
            <>
              <DropdownMenuSeparator />
              {canApprove && (
                <DropdownMenuItem
                  onClick={(event) =>
                    handleMenuAction(event, () => handleStatusChange("aprobada"))
                  }
                >
                  <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Aprobar
                </DropdownMenuItem>
              )}
              {canReject && (
                <DropdownMenuItem
                  onClick={(event) =>
                    handleMenuAction(event, () => handleStatusChange("rechazada"))
                  }
                >
                  <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Rechazar
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmDeleteOpen}
        onClose={closeConfirmDelete}
        onConfirm={handleConfirmDelete}
        title="Eliminar solicitud"
        content="Seguro que deseas eliminar la solicitud PO?"
        confirmColor="warning"
        loading={busyAction === "delete"}
      />
    </>
  );
};

// Renderiza el menu contextual de acciones en el formulario.
const PoSolicitudActionsMenuForm = () => {
  const state = usePoSolicitudActionState();

  if (!state) {
    return null;
  }

  const {
    record,
    resource,
    busyAction,
    canApprove,
    canReject,
    handleStatusChange,
    handleMenuAction,
    redirect,
    confirmDeleteOpen,
    openConfirmDelete,
    closeConfirmDelete,
    handleConfirmDelete,
  } = state;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busyAction !== null}
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
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => handleMenuAction(event, openConfirmDelete)}
            disabled={busyAction !== null}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Eliminar
          </DropdownMenuItem>
          {(canApprove || canReject) && busyAction === null ? (
            <>
              <DropdownMenuSeparator />
              {canApprove && (
                <DropdownMenuItem
                  onClick={(event) =>
                    handleMenuAction(event, () => handleStatusChange("aprobada"))
                  }
                >
                  <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Aprobar
                </DropdownMenuItem>
              )}
              {canReject && (
                <DropdownMenuItem
                  onClick={(event) =>
                    handleMenuAction(event, () => handleStatusChange("rechazada"))
                  }
                >
                  <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Rechazar
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmDeleteOpen}
        onClose={closeConfirmDelete}
        onConfirm={handleConfirmDelete}
        title="Eliminar solicitud"
        content="Seguro que deseas eliminar la solicitud PO?"
        confirmColor="warning"
        loading={busyAction === "delete"}
      />
    </>
  );
};
// endregion

export { PoSolicitudActionsMenuList, PoSolicitudActionsMenuForm };
