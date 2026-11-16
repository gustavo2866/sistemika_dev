"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useDelete, useNotify, useRecordContext, useRedirect, useRefresh, type RedirectionSideEffect } from "ra-core";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import type { ErpCashCuenta } from "./model";

export const CashCuentaDeleteButton = ({ redirect }: { redirect: RedirectionSideEffect }) => {
  const record = useRecordContext<ErpCashCuenta>();
  const [open, setOpen] = useState(false);
  const [deleteAccount, { isPending }] = useDelete();
  const notify = useNotify();
  const redirectTo = useRedirect();
  const refresh = useRefresh();
  if (!record) return null;

  const confirmDelete = () => {
    deleteAccount("erp/cash/cuentas", { id: record.id, previousData: record }, {
      mutationMode: "pessimistic",
      onSuccess: () => {
        setOpen(false);
        notify("Cuenta Cash eliminada", { type: "info" });
        if (redirect === false) refresh();
        else redirectTo(redirect, "erp/cash/cuentas", record.id, record);
      },
      onError: (error) => {
        setOpen(false);
        notify(error instanceof Error ? error.message : "No se pudo eliminar la cuenta Cash", { type: "warning" });
      },
    });
  };

  return <>
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setOpen(true)} disabled={isPending}>
      <Trash2 className="size-3" />Eliminar
    </Button>
    <Confirm
      isOpen={open}
      title="Eliminar cuenta Cash"
      content={`¿Querés eliminar la cuenta «${record.descripcion}»? Solo se puede eliminar si no tiene registros en Cash proyectado.`}
      confirm="Eliminar"
      confirmColor="warning"
      loading={isPending}
      onClose={() => { if (!isPending) setOpen(false); }}
      onConfirm={confirmDelete}
    />
  </>;
};
