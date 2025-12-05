import { useState } from "react";
import { useNotify, useDataProvider, useRefresh } from "ra-core";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CRMMensaje } from "./model";

interface DiscardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensaje: CRMMensaje | null;
}

export const DiscardDialog = ({ open, onOpenChange, mensaje }: DiscardDialogProps) => {
  const [loading, setLoading] = useState(false);
  const notify = useNotify();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();

  const handleDialogChange = (open: boolean) => {
    if (loading) return;
    onOpenChange(open);
  };

  const handleConfirm = async () => {
    if (!mensaje) return;
    setLoading(true);
    try {
      await dataProvider.update("crm/mensajes", {
        id: mensaje.id,
        data: { ...mensaje, estado: "descartado" },
        previousData: mensaje,
      });
      notify("Mensaje descartado", { type: "success" });
      onOpenChange(false);
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo descartar el mensaje", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Descartar mensaje</DialogTitle>
          <DialogDescription>
            Esta acción marcará el mensaje seleccionado como descartado. ¿Deseas continuar?
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground">
          {mensaje ? (
            <>
              <p className="font-semibold text-foreground">
                #{mensaje.id} · {mensaje.asunto || "Sin asunto"}
              </p>
              <p>{mensaje.contacto?.nombre_completo || mensaje.contacto_referencia || "Sin referencia"}</p>
            </>
          ) : (
            <p>Selecciona un mensaje para descartar.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleDialogChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !mensaje}>
            {loading ? "Descartando..." : "Descartar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
