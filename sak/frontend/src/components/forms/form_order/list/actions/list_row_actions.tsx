"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  useCreatePath,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const FormOrderListRowActions = ({
  contextSearch,
  className,
  extraMenuItems,
  showShow = true,
  showDelete = true,
  refreshEventName,
}: {
  contextSearch?: string;
  className?: string;
  extraMenuItems?: ReactNode;
  showShow?: boolean;
  showDelete?: boolean;
  refreshEventName?: string;
}) => {
  return (
    <RowActionDialogProvider>
      <FormOrderListRowActionsContent
        contextSearch={contextSearch}
        className={className}
        extraMenuItems={extraMenuItems}
        showShow={showShow}
        showDelete={showDelete}
        refreshEventName={refreshEventName}
      />
    </RowActionDialogProvider>
  );
};

const FormOrderListRowActionsContent = ({
  contextSearch,
  className,
  extraMenuItems,
  showShow = true,
  showDelete = true,
  refreshEventName,
}: {
  contextSearch?: string;
  className?: string;
  extraMenuItems?: ReactNode;
  showShow?: boolean;
  showDelete?: boolean;
  refreshEventName?: string;
}) => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const dialog = useRowActionDialog();
  const [busy, setBusy] = useState(false);

  const statusKey = String((record as any)?.order_status?.nombre ?? "")
    .trim()
    .toLowerCase();
  const isLocked = statusKey === "aprobada" || statusKey === "rechazada";

  const stopRowClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const buildPath = (type: "show") => {
    if (!resource || !record?.id) return "";
    const base = createPath({ resource, type, id: record.id });
    return contextSearch ? `${base}${contextSearch}` : base;
  };

  const handleShow = (event: React.MouseEvent) => {
    stopRowClick(event);
    if (busy || !resource || !record?.id) return;
    navigate(buildPath("show"));
  };

  const handleDelete = async () => {
    if (!record?.id || busy || !resource) return;
    setBusy(true);
    try {
      await dataProvider.delete(resource, { id: record.id, previousData: record });
      notify("Registro eliminado", { type: "info" });
      refresh();
      if (refreshEventName && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(refreshEventName));
      }
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar", { type: "warning" });
    } finally {
      setBusy(false);
    }
  };

  if (!record || !resource) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-5 w-5 sm:h-6 sm:w-6", className)}
          disabled={busy}
          onClick={stopRowClick}
          data-row-click="ignore"
        >
          <MoreHorizontal className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="sr-only">Acciones</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 sm:w-40" forceMount>
        {showShow ? (
          <DropdownMenuItem
            onClick={handleShow}
            disabled={busy}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Eye className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Visualizar
          </DropdownMenuItem>
        ) : null}
        {!isLocked && showDelete ? (
          <DropdownMenuItem
            onClick={(event) => {
              stopRowClick(event);
              if (busy) return;
              dialog?.openDialog({
                title: "Eliminar registro",
                content: "Seguro que deseas eliminar este registro?",
                confirmLabel: "Eliminar",
                confirmColor: "warning",
                onConfirm: handleDelete,
              });
            }}
            disabled={busy}
            variant="destructive"
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Eliminar
          </DropdownMenuItem>
        ) : null}
        {extraMenuItems ? <DropdownMenuSeparator /> : null}
        {extraMenuItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export type RowActionDialogConfig = {
  title: ReactNode;
  content: ReactNode;
  confirmLabel?: string;
  confirmColor?: "primary" | "warning";
  confirmDisabled?: boolean;
  onConfirm: () => Promise<void> | void;
  contentClassName?: string;
  overlayClassName?: string;
  portalContainer?: HTMLElement | null;
  contained?: boolean;
};

const RowActionDialogContext = createContext<{
  openDialog: (config: RowActionDialogConfig) => void;
} | null>(null);

export const useRowActionDialog = () => useContext(RowActionDialogContext);

export const RowActionDialogProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [dialogConfig, setDialogConfig] = useState<RowActionDialogConfig | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const openDialog = useCallback((config: RowActionDialogConfig) => {
    setDialogConfig(config);
  }, []);

  const handleDialogClose = useCallback(() => {
    if (dialogLoading) return;
    setDialogConfig(null);
  }, [dialogLoading]);

  const stopDialogEvent = useCallback((event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialogConfig?.onConfirm) {
      setDialogConfig(null);
      return;
    }
    setDialogLoading(true);
    try {
      await dialogConfig.onConfirm();
    } catch (error) {
      console.error(error);
    } finally {
      setDialogLoading(false);
      setDialogConfig(null);
    }
  }, [dialogConfig]);

  return (
    <RowActionDialogContext.Provider value={{ openDialog }}>
      <Dialog
        open={Boolean(dialogConfig)}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
      >
        {children}
        {dialogConfig ? (
          <DialogContent
            className={cn(dialogConfig.contentClassName)}
            overlayClassName={dialogConfig.overlayClassName}
            portalContainer={dialogConfig.portalContainer}
            contained={dialogConfig.contained}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>{dialogConfig.title}</DialogTitle>
              {typeof dialogConfig.content === "string" ? (
                <DialogDescription>{dialogConfig.content}</DialogDescription>
              ) : (
                dialogConfig.content
              )}
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={dialogLoading}
                onPointerDown={stopDialogEvent}
                onClick={(event) => {
                  stopDialogEvent(event);
                  handleDialogClose();
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={dialogLoading || Boolean(dialogConfig.confirmDisabled)}
                onPointerDown={stopDialogEvent}
                onClick={(event) => {
                  stopDialogEvent(event);
                  void handleDialogConfirm();
                }}
                variant={
                  dialogConfig.confirmColor === "warning"
                    ? "destructive"
                    : "default"
                }
              >
                {dialogConfig.confirmLabel ?? "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </RowActionDialogContext.Provider>
  );
};

