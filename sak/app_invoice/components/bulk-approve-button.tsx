"use client";

import React, { useState } from "react";
import { useListContext, useUpdate, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { Confirm } from "@/components/confirm";

export const BulkApproveButton = () => {
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
      // Update each selected factura to "aprobada" state
      for (const id of selectedIds) {
        await update("facturas", {
          id,
          data: { estado: "aprobada" },
          previousData: {},
        });
      }

      notify(`${selectedIds.length} facturas aprobadas exitosamente`, {
        type: "success",
      });
      
      onUnselectItems();
      refresh();
      setOpen(false);
    } catch {
      notify("Error al aprobar las facturas", { type: "error" });
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
        <CheckCircle className="mr-2 h-4 w-4" />
        Aprobar ({selectedIds.length})
      </Button>
      
      <Confirm
        isOpen={open}
        loading={isLoading}
        title="Aprobar Facturas"
        content={`¿Está seguro que desea aprobar ${selectedIds.length} facturas?`}
        onConfirm={handleConfirm}
        onClose={handleClose}
        confirm="Aprobar"
        cancel="Cancelar"
      />
    </>
  );
};
