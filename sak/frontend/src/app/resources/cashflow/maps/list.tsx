"use client";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderListRowActions,
  ListNumber,
  ListPaginator,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_STANDARD_PLUS } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";

const filters = buildListFilters(
  [
    { type: "text", props: { source: "q", label: "Buscar", placeholder: "Buscar mapeos", alwaysOn: true } },
    { type: "text", props: { source: "moneda", label: "Moneda", alwaysOn: true } },
    { type: "text", props: { source: "categoria", label: "Categoría" } },
  ],
  { keyPrefix: "erp-cash-maps" },
);

type ErpCashMapListProps = { embedded?: boolean; rowClick?: any; perPage?: number; createTo?: string };

const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <CreateButton label="Crear" to={createTo} />
    <ExportButton label="Exportar" />
  </div>
);

export const ErpCashMapList = ({ embedded = false, rowClick = "edit", perPage = 25, createTo }: ErpCashMapListProps = {}) => (
  <List
    resource="erp/cash/maps"
    title="Mapeo Cash"
    filters={filters}
    actions={<ListActions createTo={createTo} />}
    perPage={perPage}
    pagination={<ListPaginator />}
    sort={{ field: "nro_cta", order: "ASC" }}
    containerClassName={LIST_CONTAINER_STANDARD_PLUS}
    disableSyncWithLocation={embedded}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ResponsiveDataTable rowClick={rowClick} mobileConfig={{ primaryField: "nro_cta", secondaryFields: ["moneda", "categoria"] }}>
      <NumberListColumn source="nro_cta" label="Cuenta ERP" className="w-[100px]"><ListNumber source="nro_cta" /></NumberListColumn>
      <TextListColumn source="moneda" label="Moneda" className="w-[90px]"><ListText source="moneda" /></TextListColumn>
      <TextListColumn source="categoria" label="Categoría" className="w-[120px]"><ListText source="categoria" /></TextListColumn>
      <TextListColumn source="map_debe_id" label="Mapeo Debe">
        <ReferenceField source="map_debe_id" reference="erp/cash/cuentas" link={false}><ListText source="descripcion" /></ReferenceField>
      </TextListColumn>
      <TextListColumn source="map_haber_id" label="Mapeo Haber">
        <ReferenceField source="map_haber_id" reference="erp/cash/cuentas" link={false}><ListText source="descripcion" /></ReferenceField>
      </TextListColumn>
      <TextListColumn label="Acciones" className="w-[64px]"><FormOrderListRowActions showShow={false} /></TextListColumn>
    </ResponsiveDataTable>
  </List>
);
