"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useListContext } from "ra-core";
import { processItems } from "@/lib/item-actions";
import { Play } from "lucide-react";

export const BulkProcessButton = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const [loading, setLoading] = useState(false);

  const handleProcess = async () => {
    if (selectedIds.length === 0) return;
    
    setLoading(true);
    try {
      await processItems(selectedIds);
      onUnselectItems(); // Deseleccionar items después de la acción
    } catch (error) {
      console.error("Error processing items:", error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <Button
      onClick={handleProcess}
      disabled={loading}
      variant="outline"
      size="sm"
      className="text-blue-600 hover:text-blue-700"
    >
      <Play className="h-4 w-4 mr-2" />
      {loading ? "Procesando..." : `Procesar (${selectedIds.length})`}
    </Button>
  );
};
