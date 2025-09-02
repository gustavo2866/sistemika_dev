"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useListContext } from "ra-core";
import { confirmItems } from "@/lib/item-actions";
import { Check } from "lucide-react";

export const BulkConfirmButton = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    
    setLoading(true);
    try {
      await confirmItems(selectedIds);
      onUnselectItems(); // Deseleccionar items después de la acción
    } catch (error) {
      console.error("Error confirming items:", error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleConfirm}
      disabled={loading}
      variant="outline"
      size="sm"
      className="text-green-600 hover:text-green-700"
    >
      <Check className="h-4 w-4 mr-2" />
      {loading ? "Confirmando..." : `Confirmar (${selectedIds.length})`}
    </Button>
  );
};
