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
import { List, LIST_CONTAINER_2XL } from "@/components/list";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";


const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "periodo_anio",
        label: "Año",
        alwaysOn: true,
        className: "w-[82px]",
      },
    },
    {
      type: "text",
      props: {
        source: "periodo_mes",
        label: "Mes",
        alwaysOn: true,
        className: "w-[70px]",
      },
    },
    {
      type: "text",
      props: {
        source: "empresa_id",
        label: "Empresa",
        alwaysOn: true,
        className: "w-[90px]",
      },
    },
    { type: "text", props: { source: "nivel", label: "Nivel" } },
    { type: "text", props: { source: "cuenta_codigo", label: "Cuenta" } },
    { type: "text", props: { source: "nro_subcuenta", label: "Subcuenta" } },
    { type: "text", props: { source: "centro_costo", label: "Centro de costo" } },
  ],
  { keyPrefix: "erp-libro-mayor" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const currentPeriod = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const ListActions = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [periodo, setPeriodo] = useState(currentPeriod);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!periodo || !window.confirm(`Se reemplazará Libro Mayor del período ${periodo}. ¿Continuar?`)) {
      return;
    }

    setSyncing(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/erp/libro-mayor/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ periodo }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof result.detail === "string"
          ? result.detail
          : "No se pudo sincronizar Libro Mayor";
        throw new Error(detail);
      }

      notify(
        `Período ${result.periodo}: ${result.rows_inserted} registros sincronizados`,
        { type: "success" },
      );
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo sincronizar Libro Mayor", {
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

export const ErpLibroMayorList = () => (
  <List
    resource="erp/libro-mayor"
    title="Libro Mayor ERP"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "source_id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_2XL}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "cuenta_codigo",
        secondaryFields: ["fecha_periodo", "empresa_id", "nivel", "saldo_acumulado"],
      }}
      className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]"
    >
      <DateListColumn source="fecha_periodo" label="Período" className="w-[82px]">
        <ListDate source="fecha_periodo" options={{ timeZone: "UTC" }} empty="-" />
      </DateListColumn>
      <NumberListColumn source="empresa_id" label="Empresa" className="w-[58px]">
        <ListNumber source="empresa_id" />
      </NumberListColumn>
      <TextListColumn source="nivel" label="Nivel" className="w-[72px]">
        <ListText source="nivel" />
      </TextListColumn>
      <NumberListColumn source="cuenta_codigo" label="Cuenta" className="w-[82px]">
        <ListNumber source="cuenta_codigo" />
      </NumberListColumn>
      <TextListColumn source="tipo_subcuenta" label="Tipo sub." className="w-[68px]">
        <ListText source="tipo_subcuenta" empty="-" />
      </TextListColumn>
      <TextListColumn source="nro_subcuenta" label="Subcuenta" className="w-[82px]">
        <ListText source="nro_subcuenta" empty="-" />
      </TextListColumn>
      <TextListColumn source="centro_costo" label="C. costo" className="w-[72px]">
        <ListText source="centro_costo" empty="-" />
      </TextListColumn>
      <NumberListColumn source="saldo_anterior" label="Anterior" className="w-[105px] text-right">
        <ListMoney source="saldo_anterior" showCurrency={false} />
      </NumberListColumn>
      <NumberListColumn source="total_debe_actualizado" label="Debe act." className="w-[105px] text-right">
        <ListMoney source="total_debe_actualizado" showCurrency={false} />
      </NumberListColumn>
      <NumberListColumn source="total_haber_actualizado" label="Haber act." className="w-[105px] text-right">
        <ListMoney source="total_haber_actualizado" showCurrency={false} />
      </NumberListColumn>
      <NumberListColumn source="saldo_periodo" label="Período" className="w-[105px] text-right">
        <ListMoney source="saldo_periodo" showCurrency={false} />
      </NumberListColumn>
      <NumberListColumn source="saldo_acumulado" label="Acumulado" className="w-[105px] text-right">
        <ListMoney source="saldo_acumulado" showCurrency={false} />
      </NumberListColumn>
      <TextListColumn label="Acciones" className="w-[58px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpLibroMayorList;
