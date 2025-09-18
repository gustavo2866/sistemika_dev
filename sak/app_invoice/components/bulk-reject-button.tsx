"use client";

import React, { useState } from "react";
import { useListContext, useUpdate, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { Confirm } from "@/components/confirm";

export const BulkRejectButton = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    
    try {
      // Update each selected factura to "rechazada" state
      for (const id of selectedIds) {
        await update("facturas", {
          id,
          data: { estado: "rechazada" },
          previousData: {},
        });
      }

      notify(`${selectedIds.length} facturas rechazadas exitosamente`, {
        type: "success",
      });
      
      onUnselectItems();
      refresh();
      setOpen(false);
    } catch {
      notify("Error al rechazar las facturas", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={selectedIds.length === 0}
        variant="outline"
        size="sm"
        className="h-8 px-2 lg:px-3"
      >
        <XCircle className="mr-2 h-4 w-4" />
        Rechazar ({selectedIds.length})
      </Button>
      
      <Confirm
        isOpen={open}
        loading={isLoading}
        title="Rechazar Facturas"
        content={`¿Está seguro que desea rechazar ${selectedIds.length} facturas?`}
        onConfirm={handleConfirm}
        onClose={handleClose}
        confirm="Rechazar"
        cancel="Cancelar"
        confirmColor="warning"
      />
    </>
  );
};
