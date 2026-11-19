"use client";

import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { useGetList, useListContext, useNotify, useRefresh, useUpdateMany, type Identifier } from "ra-core";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import type { SelectInputProps } from "@/components/select-input";
import { CompactSelectInput } from "@/components/forms/form_order/filter";
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

const CategoryFilter = (props: SelectInputProps) => {
  const categories = useGetList<{ id: string; name: string }>("erp/cash/maps/categorias", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
    filter: {},
  });
  return (
    <CompactSelectInput
      {...props}
      choices={(categories.data ?? []).filter((category) => category.id.trim().toLowerCase() !== "error")}
      isPending={categories.isPending}
      disabled={Boolean(categories.error)}
      helperText={categories.error ? "No se pudieron cargar las categorías" : undefined}
      emptyText="Todas"
    />
  );
};

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar subcuentas", alwaysOn: true } },
    { type: "custom", element: <CategoryFilter key="erp-cash-subctas-categoria" source="categoria" label="Categoría" alwaysOn /> },
    { type: "text", props: { source: "tpo_subcta", label: "Tipo de subcuenta", type: "number", min: 0, step: 1, alwaysOn: true } },
    { type: "select", props: { source: "estado", label: "Estado", choices: ERP_CASH_SUBCTA_ESTADO_CHOICES, emptyText: "Todos", alwaysOn: true } },
  ],
  { keyPrefix: "erp-cash-subctas" },
);

type ErpCashSubctaListProps = { embedded?: boolean; rowClick?: any; perPage?: number; createTo?: string };

const SubcuentaStateButtons = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const [selection, setSelection] = useState<{ ids: Identifier[]; estado: "activa" | "bloqueada" } | null>(null);
  const [updateMany, { isPending }] = useUpdateMany();
  const activating = selection?.estado === "activa";
  const action = activating ? "Activar" : "Bloquear";
  const count = selection?.ids.length ?? 0;

  const handleConfirm = () => {
    if (!selection?.ids.length || isPending) return;
    updateMany("erp/cash/subctas", { ids: selection.ids, data: { estado: selection.estado } }, {
      mutationMode: "pessimistic",
      onSuccess: () => {
        const status = activating ? "activada" : "bloqueada";
        notify(count === 1 ? `Subcuenta ${status}` : `${count} subcuentas ${status}s`, { type: "success" });
        setSelection(null);
        onUnselectItems();
        refresh();
      },
      onError: () => {
        notify(`No se pudo completar ${activating ? "la activación" : "el bloqueo"}. Revisá el listado antes de reintentar.`, { type: "error" });
        setSelection(null);
        refresh();
      },
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={!selectedIds.length || isPending} onClick={() => setSelection({ ids: [...selectedIds], estado: "activa" })}>
        <Unlock className="h-4 w-4" />
        Activar
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!selectedIds.length || isPending} onClick={() => setSelection({ ids: [...selectedIds], estado: "bloqueada" })}>
        <Lock className="h-4 w-4" />
        Bloquear
      </Button>
      <Confirm
        isOpen={selection !== null}
        title={`${action} subcuentas`}
        content={`${count === 1 ? `¿${action} la subcuenta seleccionada?` : `¿${action} las ${count} subcuentas seleccionadas?`} ${activating ? "Se activarán aunque no tengan categoría asignada. Se conservarán las categorías existentes y se considerarán en la próxima actualización Cash." : "Conservarán su categoría y quedarán excluidas del procesamiento automático futuro."}`}
        confirm={action}
        cancel="Cancelar"
        ConfirmIcon={activating ? Unlock : Lock}
        loading={isPending}
        onClose={() => { if (!isPending) setSelection(null); }}
        onConfirm={handleConfirm}
      />
    </>
  );
};

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <SubcuentaStateButtons />
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
