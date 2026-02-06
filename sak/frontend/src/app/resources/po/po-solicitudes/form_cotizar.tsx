"use client";

import { useState } from "react";
import { useGetIdentity, useGetOne, useRecordContext } from "ra-core";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type PoSolicitud } from "./model";
import { usePoSolicitudCotizar } from "./form_hooks";

const CotizarConfirmDialog = ({
  open,
  loading,
  onClose,
  onCotizar,
  onCotizarAndShow,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCotizar: () => void;
  onCotizarAndShow: () => void;
}) => (
  <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? null : onClose())}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Cotizar solicitud</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        ¿Querés cotizar la solicitud? Se guardarán los cambios pendientes.
      </p>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={onCotizar} disabled={loading}>
          Cotizar
        </Button>
        <Button type="button" onClick={onCotizarAndShow} disabled={loading}>
          Cotizar y abrir
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const FormCotizar = ({ onClose }: { onClose: () => void }) => {
  const record = useRecordContext<PoSolicitud>();
  const { data: identity } = useGetIdentity();
  const identityId = identity && typeof identity.id !== "undefined" ? Number(identity.id) : null;
  const { data: userData } = useGetOne(
    "users",
    { id: identityId ?? 0 },
    { enabled: Boolean(identityId) }
  );
  const departamentoId =
    (userData as { departamento_id?: number | null } | undefined)?.departamento_id ??
    (identity as { departamento_id?: number | null } | undefined)?.departamento_id ??
    null;
  const { data: departamentoData } = useGetOne(
    "departamentos",
    { id: departamentoId ?? 0 },
    { enabled: Boolean(departamentoId) }
  );
  const departamentoNombre = (departamentoData as { nombre?: string } | undefined)?.nombre ?? "";
  const isCompras =
    typeof departamentoNombre === "string" &&
    departamentoNombre.toLowerCase().includes("compras");
  const [cotizarOpen, setCotizarOpen] = useState(false);
  const { canCotizar, cotizar, loading: cotizarLoading } = usePoSolicitudCotizar({
    onClose,
  });

  if (!record?.id || !canCotizar || !isCompras) return null;

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setCotizarOpen(true)}
        className="h-7 px-2 text-[11px] sm:h-9 sm:px-4 sm:text-sm"
      >
        <CheckCircle2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
        Cotizar
      </Button>
      <CotizarConfirmDialog
        open={cotizarOpen}
        loading={cotizarLoading}
        onClose={() => setCotizarOpen(false)}
        onCotizar={() => cotizar(false)}
        onCotizarAndShow={() => cotizar(true)}
      />
    </>
  );
};
