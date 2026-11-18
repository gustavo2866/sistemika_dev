"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useListContext, useNotify, useRefresh, useUpdateMany, type Identifier } from "ra-core";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ListStatus,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { ERP_CASH_SUBCTA_ESTADO_CHOICES, ERP_CASH_SUBCTA_ESTADO_CLASSES } from "./model";

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar subcuentas", alwaysOn: true } },
    { type: "text", props: { source: "categoria", label: "Categoría", alwaysOn: true } },
    { type: "select", props: { source: "estado", label: "Estado", choices: ERP_CASH_SUBCTA_ESTADO_CHOICES, emptyText: "Todos", alwaysOn: true } },
  ],
  { keyPrefix: "erp-cash-subctas" },
);

type ErpCashSubctaListProps = { embedded?: boolean; rowClick?: any; perPage?: number; createTo?: string };

const BloquearButton = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [idsToBlock, setIdsToBlock] = useState<Identifier[]>([]);
  const [updateMany, { isPending }] = useUpdateMany();

  const handleConfirm = () => {
    if (!idsToBlock.length || isPending) return;
    updateMany("erp/cash/subctas", { ids: idsToBlock, data: { estado: "bloqueada" } }, {
      mutationMode: "pessimistic",
      onSuccess: () => {
        notify(idsToBlock.length === 1 ? "Subcuenta bloqueada" : `${idsToBlock.length} subcuentas bloqueadas`, { type: "success" });
        setIdsToBlock([]);
        onUnselectItems();
        refresh();
      },
      onError: () => {
        notify("No se pudo completar el bloqueo. Revisá el listado antes de reintentar.", { type: "error" });
        setIdsToBlock([]);
        refresh();
      },
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={!selectedIds.length || isPending} onClick={() => setIdsToBlock([...selectedIds])}>
        <Lock className="h-4 w-4" />
        Bloquear
      </Button>
      <Confirm
        isOpen={idsToBlock.length > 0}
        title="Bloquear subcuentas"
        content={`${idsToBlock.length === 1 ? "¿Bloquear la subcuenta seleccionada?" : `¿Bloquear las ${idsToBlock.length} subcuentas seleccionadas?`} Conservarán su categoría y quedarán excluidas del procesamiento automático futuro.`}
        confirm="Bloquear"
        cancel="Cancelar"
        ConfirmIcon={Lock}
        loading={isPending}
        onClose={() => { if (!isPending) setIdsToBlock([]); }}
        onConfirm={handleConfirm}
      />
    </>
  );
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <BloquearButton />
    <CreateButton label="Crear" to={createTo} />
    <ExportButton label="Exportar" />
  </div>
);

export const ErpCashSubctaList = ({ embedded = false, rowClick = "edit", perPage = 10, createTo }: ErpCashSubctaListProps = {}) => (
  <List
    resource="erp/cash/subctas"
    title="Subcuentas Cash"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nro_subcta", order: "ASC" }}
    containerClassName={LIST_CONTAINER_STANDARD_PLUS}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable
      rowClick={rowClick}
      bulkActionButtons={false}
      bulkActionsToolbar={<></>}
      mobileConfig={{ primaryField: "descripcion", secondaryFields: ["nro_subcta", "categoria", "estado"] }}
    >
      <TextListColumn source="nro_subcta" label="Subcuenta" className="w-[110px]">
        <div className="grid grid-cols-[20px_48px] gap-1 tabular-nums">
          <ListText source="tpo_subcta" className="whitespace-nowrap text-muted-foreground" />
          <ListText source="nro_subcta" className="whitespace-nowrap" />
        </div>
      </TextListColumn>
      <TextListColumn source="descripcion" label="Descripción" className="w-auto min-w-[320px]"><ListText source="descripcion" className="whitespace-normal break-words" /></TextListColumn>
      <TextListColumn source="categoria" label="Categoría" className="w-[100px]"><ListText source="categoria" /></TextListColumn>
      <TextListColumn source="estado" label="Estado" className="w-[80px]"><ListStatus source="estado" statusClasses={ERP_CASH_SUBCTA_ESTADO_CLASSES} /></TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]"><FormOrderListRowActions showShow={false} /></TextListColumn>
    </ResponsiveDataTable>
  </List>
);
