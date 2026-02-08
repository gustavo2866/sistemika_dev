"use client";

import { useState } from "react";
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

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const FormOrderListRowActions = ({
  contextSearch,
  className,
}: {
  contextSearch?: string;
  className?: string;
}) => {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!record || !resource) {
    return null;
  }

  const stopRowClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const buildPath = (type: "show") => {
    const base = createPath({ resource, type, id: record.id });
    return contextSearch ? `${base}${contextSearch}` : base;
  };

  const handleShow = (event: React.MouseEvent) => {
    stopRowClick(event);
    if (busy) return;
    navigate(buildPath("show"));
  };

  const handleDelete = async () => {
    if (!record?.id || busy) return;
    setBusy(true);
    try {
      await dataProvider.delete(resource, { id: record.id, previousData: record });
      notify("Registro eliminado", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar", { type: "warning" });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 sm:h-7 sm:w-7", className)}
            disabled={busy}
            onClick={stopRowClick}
            data-row-click="ignore"
          >
            <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-24 sm:w-32">
          <DropdownMenuItem
            onClick={handleShow}
            disabled={busy}
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Eye className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              stopRowClick(event);
              if (busy) return;
              setConfirmDelete(true);
            }}
            disabled={busy}
            variant="destructive"
            className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          >
            <Trash2 className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar registro"
        content="Seguro que deseas eliminar este registro?"
        confirmColor="warning"
        loading={busy}
      />
    </>
  );
};
