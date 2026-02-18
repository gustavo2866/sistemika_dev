"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDataProvider,
  useListContext,
  useNotify,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/confirm";
import { formatCurrency } from "@/lib/formatters";

import type { PoInvoiceFormValues } from "./model";

const resolveStatusFinByOrden = async (
  dataProvider: ReturnType<typeof useDataProvider>,
  orden: number,
) => {
  const { data } = await dataProvider.getList("po-invoice-status-fin", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "orden", order: "ASC" },
    filter: { orden },
  });
  const status = data?.[0];
  if (status?.id) {
    return { id: status.id as number, nombre: status.nombre as string };
  }
  return null;
};

export const PoInvoiceAgendaBulkPagarButton = ({
  disabled,
}: {
  disabled?: boolean;
}) => {
  const { selectedIds, onUnselectItems } = useListContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-invoices";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<Array<PoInvoiceFormValues & { id?: number }> | null>(null);

  const selectedCount = selectedIds?.length ?? 0;

  const totalSeleccionado = useMemo(() => {
    if (!records?.length) return 0;
    return records.reduce((acc, item) => acc + Number(item.total ?? 0), 0);
  }, [records]);

  const loadSelected = useCallback(async () => {
    if (!selectedIds?.length) return;
    try {
      const { data } = await dataProvider.getMany(resource, { ids: selectedIds });
      const mapped = data as Array<PoInvoiceFormValues & { id?: number }>;
      setRecords(mapped);
      return mapped;
    } catch (error) {
      console.error(error);
      setRecords(null);
      return undefined;
    }
  }, [dataProvider, resource, selectedIds]);

  useEffect(() => {
    setRecords(null);
  }, [selectedIds]);

  const handleOpen = useCallback(async () => {
    if (!selectedIds?.length || disabled || loading) return;
    const dataSource = await loadSelected();
    const statusAutorizada = await resolveStatusFinByOrden(dataProvider, 3);
    if (!statusAutorizada?.id) {
      notify("No se encontró el estado financiero Autorizada", { type: "warning" });
      return;
    }
    if (!dataSource?.length) return;
    const notAllowed = (dataSource ?? []).filter((item) => {
      const orden = (item as any)?.invoice_status_fin?.orden;
      const statusId = (item as any)?.invoice_status_fin_id;
      if (typeof orden === "number") return Number(orden) !== 3;
      return statusId !== statusAutorizada.id;
    });
    if (notAllowed.length > 0) {
      notify("Solo se pueden pagar facturas en estado Autorizada", {
        type: "warning",
      });
      return;
    }
    setOpen(true);
  }, [
    selectedIds,
    disabled,
    loading,
    loadSelected,
    dataProvider,
    notify,
  ]);

  const handleConfirm = useCallback(async () => {
    if (!selectedIds?.length) return;
    setLoading(true);
    try {
      const [statusAutorizada, statusPagada] = await Promise.all([
        resolveStatusFinByOrden(dataProvider, 3),
        resolveStatusFinByOrden(dataProvider, 4),
      ]);

      if (!statusAutorizada?.id || !statusPagada?.id) {
        notify("No se encontraron los estados financieros requeridos", {
          type: "warning",
        });
        return;
      }

      const dataSource =
        records?.length ? records : (await dataProvider.getMany(resource, { ids: selectedIds })).data;

      const notAllowed = (dataSource ?? []).filter((item) => {
        const orden = (item as any)?.invoice_status_fin?.orden;
        const statusId = (item as any)?.invoice_status_fin_id;
        if (typeof orden === "number") return Number(orden) !== 3;
        return statusId !== statusAutorizada.id;
      });

      if (notAllowed.length > 0) {
        notify("Solo se pueden pagar facturas en estado Autorizada", {
          type: "warning",
        });
        return;
      }

      for (const item of dataSource ?? []) {
        if (!item?.id) continue;
        await dataProvider.update(resource, {
          id: item.id,
          data: { invoice_status_fin_id: statusPagada.id },
          previousData: item,
        });
      }

      notify(`Se pagaron ${selectedCount} facturas`, { type: "info" });
      refresh();
      onUnselectItems();
      setOpen(false);
    } catch (error) {
      console.error(error);
      notify("No se pudieron pagar las facturas seleccionadas", {
        type: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [
    dataProvider,
    notify,
    onUnselectItems,
    records,
    refresh,
    resource,
    selectedCount,
    selectedIds,
  ]);

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={handleOpen}
        disabled={disabled || loading || !selectedCount}
        className="h-7 gap-1 px-2 text-[10px] sm:h-8 sm:text-[11px]"
      >
        <Wallet className="h-3.5 w-3.5" />
        Pagar
      </Button>
      <Confirm
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Pagar facturas"
        content={
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Seguro que deseas pagar las facturas seleccionadas?</p>
            <div className="rounded-md border border-border/70 bg-muted/10 p-2 text-[11px] sm:text-xs">
              <div>
                <span className="font-semibold text-foreground">Cantidad:</span>{" "}
                {selectedCount}
              </div>
              <div>
                <span className="font-semibold text-foreground">Total:</span>{" "}
                {formatCurrency(totalSeleccionado)}
              </div>
              <div>
                <span className="font-semibold text-foreground">Estado requerido:</span>{" "}
                Autorizada
              </div>
            </div>
          </div>
        }
        confirm="Pagar"
        confirmColor="primary"
        loading={loading}
      />
    </>
  );
};
