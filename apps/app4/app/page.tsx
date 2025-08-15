"use client";

import { CoreDialog } from "@workspace/core";
import { Button } from "@workspace/ui/components/button";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-svh">
      <CoreDialog
        trigger={<Button size="sm">Abrir diálogo</Button>}
        title="Confirmar acción"
        description="¿Desea continuar?"
        acceptLabel="Aceptar"
        cancelLabel="Cancelar"
        onAccept={() => alert("Aceptado")}
        onCancel={() => alert("Cancelado")}
      />
    </div>
  );
}
