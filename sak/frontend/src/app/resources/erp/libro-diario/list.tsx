"use client";

import { useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { RefreshCw } from "lucide-react";

import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  DateListColumn,
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
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Asiento o descripción",
      },
    },
    { type: "text", props: { source: "cuenta_codigo", label: "Cuenta" } },
    { type: "text", props: { source: "centro_costo", label: "Centro de costo" } },
  ],
  { keyPrefix: "erp-libro-diario" },
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
    if (!periodo || !window.confirm(`Se reemplazará Libro Diario del período ${periodo}. ¿Continuar?`)) {
      return;
    }

    setSyncing(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${apiUrl}/erp/libro-diario/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ periodo }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "No se pudo sincronizar Libro Diario",
        );
      }

      notify(`Libro Diario ${periodo} sincronizado`, { type: "success" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo sincronizar Libro Diario", {
        type: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
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

export const ErpLibroDiarioList = () => (
  <List
    resource="erp/libro-diario"
    title="Libro Diario"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "source_id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_2XL}
  >
    <ResponsiveDataTable
      rowClick={false}
      mobileConfig={{
        primaryField: "descripcion",
        secondaryFields: ["fecha", "empresa_id", "cuenta_codigo", "debe", "haber"],
      }}
      className="text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]"
    >
      <DateListColumn source="fecha" label="Fecha" className="w-[82px]">
        <ListDate source="fecha" options={{ timeZone: "UTC" }} />
      </DateListColumn>
      <NumberListColumn source="empresa_id" label="Empresa" className="w-[58px]">
        <ListNumber source="empresa_id" />
      </NumberListColumn>
      <TextListColumn source="tipo_asiento" label="Tipo" className="w-[58px]">
        <ListText source="tipo_asiento" empty="-" />
      </TextListColumn>
      <TextListColumn source="nro_asiento" label="Asiento" className="w-[76px]">
        <ListText source="nro_asiento" empty="-" />
      </TextListColumn>
      <NumberListColumn source="cuenta_codigo" label="Cuenta" className="w-[82px]">
        <ListNumber source="cuenta_codigo" />
      </NumberListColumn>
      <TextListColumn source="descripcion" label="Descripción">
        <ListText source="descripcion" className="whitespace-normal break-words" empty="-" />
      </TextListColumn>
      <TextListColumn source="nro_subcuenta" label="Subcuenta" className="w-[82px]">
        <ListText source="nro_subcuenta" empty="-" />
      </TextListColumn>
      <TextListColumn source="centro_costo" label="C. costo" className="w-[72px]">
        <ListText source="centro_costo" empty="-" />
      </TextListColumn>
      <NumberListColumn source="debe" label="Debe" className="w-[100px] text-right">
        <ListMoney source="debe" showCurrency={false} />
      </NumberListColumn>
      <NumberListColumn source="haber" label="Haber" className="w-[100px] text-right">
        <ListMoney source="haber" showCurrency={false} />
      </NumberListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpLibroDiarioList;
