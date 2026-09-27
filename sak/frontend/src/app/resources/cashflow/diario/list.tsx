"use client";

import { useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { RefreshCw } from "lucide-react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListMoney,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { CASH_CHOICES } from "./model";

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar movimientos", alwaysOn: true } },
    { type: "text", props: { source: "periodo_anio", label: "Año", alwaysOn: true } },
    { type: "text", props: { source: "periodo_mes", label: "Mes", alwaysOn: true } },
    { type: "select", props: { source: "cash", label: "Cash", choices: CASH_CHOICES, emptyText: "Todos" } },
  ],
  { keyPrefix: "erp-cash-diario" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";
const currentPeriod = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const ListActions = () => (
  <SyncListActions />
);

const SyncListActions = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [periodo, setPeriodo] = useState(currentPeriod);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!periodo || !window.confirm(`Se reemplazarán los movimientos del período ${periodo}. ¿Continuar?`)) {
      return;
    }

    setSyncing(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/erp/cash/diario/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ periodo }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "No se pudo sincronizar el Diario Cash");
      }

      notify(
        `Período ${result.periodo}: ${result.rows_inserted} movimientos generados`,
        { type: "success" },
      );
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo sincronizar el Diario Cash", {
        type: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
      <CreateButton className={actionButtonClass} label="Crear" />
      <ExportButton className={actionButtonClass} label="Exportar" />
      <input
        type="month"
        value={periodo}
        onChange={(event) => setPeriodo(event.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Período a sincronizar"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={actionButtonClass}
        onClick={handleSync}
        disabled={syncing || !periodo}
      >
        <RefreshCw className={`mr-1 size-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando" : "Sincronizar"}
      </Button>
    </div>
  );
};

export const ErpCashDiarioList = () => (
  <List
    resource="erp/cash/diario"
    title="Diario Cash"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "fecha", order: "DESC" }}
    containerClassName={LIST_CONTAINER_WIDE}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{ primaryField: "descripcion", secondaryFields: ["fecha", "cuenta_codigo", "cash"] }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <DateListColumn source="fecha" label="Fecha" className="w-[95px]"><ListDate source="fecha" /></DateListColumn>
      <NumberListColumn source="empresa_id" label="Empresa" className="w-[70px]"><ListNumber source="empresa_id" /></NumberListColumn>
      <TextListColumn source="nro_asiento" label="Asiento" className="w-[90px]"><ListText source="nro_asiento" /></TextListColumn>
      <NumberListColumn source="cuenta_codigo" label="Cuenta" className="w-[90px]"><ListNumber source="cuenta_codigo" /></NumberListColumn>
      <TextListColumn source="descripcion" label="Descripción"><ListText source="descripcion" className="whitespace-normal break-words" /></TextListColumn>
      <TextListColumn source="rubro" label="Rubro" className="w-[150px]"><ListText source="rubro" /></TextListColumn>
      <NumberListColumn source="debe" label="Debe" className="w-[105px]"><ListMoney source="debe" showCurrency={false} /></NumberListColumn>
      <NumberListColumn source="haber" label="Haber" className="w-[105px]"><ListMoney source="haber" showCurrency={false} /></NumberListColumn>
      <TextListColumn source="cash" label="Cash" className="w-[60px]"><ListText source="cash" /></TextListColumn>
      <TextListColumn source="cuenta_cash_id" label="Cuenta Cash" className="w-[160px]">
        <ReferenceField source="cuenta_cash_id" reference="erp/cash/cuentas" link={false}><ListText source="descripcion" /></ReferenceField>
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]"><FormOrderListRowActions showShow={false} /></TextListColumn>
    </ResponsiveDataTable>
  </List>
);
