/**
 * Acciones por fila para PoSolicitudes.
 *
 * Estructura:
 * 1. STATE - Estado interno y validaciones
 * 2. ACTIONS - Handlers de acciones de usuario
 * 3. UI - Render del menu contextual
 */

"use client";

import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
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

// Renderiza el menu de acciones por fila.
export const PoSolicitudActionsMenu = () => {
  const record = useRecordContext<PoSolicitud>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!record || !resource) {
    return null;
  }

  const isBorrador = record.estado === "borrador";
  const isEmitida = record.estado === "emitida";
  const isApproved = record.estado === "aprobada";
  const canApprove = isBorrador || isEmitida;
  const canReject = isApproved;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  // endregion

//******************************************** */
// region 2. ACTIONS

// Cambia el estado de la solicitud en el backend.
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
    const response = await fetch(`${apiBaseUrl}/po-solicitudes/${record.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ estado }),
    });
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

// Elimina la solicitud desde el dataProvider.
const handleDelete = async () => {
  if (!record?.id) return;
  setBusyAction("delete");
  try {
    await dataProvider.delete(resource, { id: record.id });
    notify("Solicitud PO eliminada", { type: "info" });
    refresh();
  } catch (error) {
    console.error(error);
    notify("No se pudo eliminar la solicitud PO", { type: "warning" });
  } finally {
    setBusyAction(null);
  }
};

// Abre el modal de confirmacion de borrado.
const handleRequestDelete = () => {
  if (!record?.id) return;
  setConfirmDeleteOpen(true);
};

// Confirma el borrado y ejecuta la accion.
const handleConfirmDelete = () => {
  setConfirmDeleteOpen(false);
  handleDelete();
};

// Evita que el click de menu dispare el rowClick.
const stopRowClick = (event: React.MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

// Ejecuta una accion del menu respetando estado ocupado.
const handleMenuAction = (
  event: React.MouseEvent,
  callback: () => void,
) => {
  stopRowClick(event);
  if (busyAction !== null) {
    return;
  }
  callback();
};
// endregion

//******************************************** */
// region 3. UI

// Renderiza el menu contextual con acciones.
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
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40 sm:w-44 text-[10px] sm:text-xs"
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
          onClick={(event) => handleMenuAction(event, handleRequestDelete)}
          disabled={busyAction !== null}
          variant="destructive"
        >
          <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Eliminar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () =>
              canApprove && handleStatusChange("aprobada")
            )
          }
          disabled={!canApprove || busyAction !== null}
        >
          <CheckCircle2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Aprobar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) =>
            handleMenuAction(event, () =>
              canReject && handleStatusChange("rechazada")
            )
          }
          disabled={!canReject || busyAction !== null}
        >
          <XCircle className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          Rechazar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Confirm
      isOpen={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      onConfirm={handleConfirmDelete}
      title="Eliminar solicitud"
      content="Seguro que deseas eliminar la solicitud PO?"
      confirm="Eliminar"
      cancel="Cancelar"
    />
  </>
);
// endregion
};
