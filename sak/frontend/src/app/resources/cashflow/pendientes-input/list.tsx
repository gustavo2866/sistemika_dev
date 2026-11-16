"use client";

import { useEffect } from "react";
import { useGetList, useListContext, useRecordContext } from "ra-core";
import { Unlink } from "lucide-react";

import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import { Button } from "@/components/ui/button";
import {
  BooleanListColumn,
  FormOrderListRowActions,
  ListPaginator,
  ListText,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import {
  ERP_CASH_PENDIENTES_INPUT_IMPORT_STATUS_CHOICES,
  ERP_CASH_PENDIENTES_INPUT_VALIDATION_STATUS_CHOICES,
  type ErpCashPendientesInput,
} from "./model";
import type { ErpCuenta } from "../../erp/cuentas/model";
import type { ErpCashCuenta } from "../cuentas/model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Empresa, archivo, nombre o descripción",
        alwaysOn: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "erp_empresa_id",
        reference: "erp/empresas",
        label: "Empresa",
      },
      selectProps: { optionText: "empresa_nombre", emptyText: "Todas" },
    },
    {
      type: "reference",
      referenceProps: {
        source: "cuenta_cash_id",
        reference: "erp/cash/cuentas",
        label: "Cuenta Cash",
      },
      selectProps: { optionText: "descripcion", emptyText: "Todas" },
    },
    {
      type: "select",
      props: {
        source: "import_status",
        label: "Importación",
        choices: ERP_CASH_PENDIENTES_INPUT_IMPORT_STATUS_CHOICES,
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "validation_status",
        label: "Validación",
        choices: ERP_CASH_PENDIENTES_INPUT_VALIDATION_STATUS_CHOICES,
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "erp-cash-pendientes-input" },
);

const joinRawValues = (...values: Array<string | null | undefined>) => {
  const parts = values.map((value) => value?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "-";
};

const ComprobanteField = () => {
  const record = useRecordContext<ErpCashPendientesInput>();

  return (
    <div className="min-w-0">
      <div className="font-medium">
        {joinRawValues(record?.tipcomp_raw, record?.nrocomp_raw)}
      </div>
      <div className="whitespace-normal break-words text-muted-foreground">
        {record?.nombre_raw?.trim() || "-"}
      </div>
    </div>
  );
};

const SubcuentaField = () => {
  const record = useRecordContext<ErpCashPendientesInput>();

  return (
    <div className="min-w-0">
      <div className="font-medium">
        {joinRawValues(record?.tipsub_raw, record?.nrosub_raw)}
      </div>
      <div className="whitespace-normal break-words text-muted-foreground">
        {record?.subs_descrip_raw?.trim() || "-"}
      </div>
    </div>
  );
};

const CuentaField = () => {
  const record = useRecordContext<ErpCashPendientesInput>();
  const rawAccountNumber = record?.nrocta_raw?.trim() || "";
  const accountNumber = Number(rawAccountNumber);
  const hasAccountNumber = rawAccountNumber !== "" && Number.isFinite(accountNumber);
  const { data: cuentas = [] } = useGetList<ErpCuenta>(
    "erp/cuentas",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { nro_cuenta: hasAccountNumber ? accountNumber : -1 },
    },
    { enabled: hasAccountNumber },
  );
  const cuenta = cuentas[0];

  if (!cuenta) {
    return <span>{rawAccountNumber || "-"}</span>;
  }

  return (
    <div className="min-w-0">
      <div className="font-medium">
        {joinRawValues(String(cuenta.nro_cuenta ?? ""), cuenta.cod_cuenta)}
      </div>
      <div className="whitespace-normal break-words text-muted-foreground">
        {cuenta.descripcion?.trim() || "-"}
      </div>
    </div>
  );
};

const CuentaCashField = () => {
  const cuenta = useRecordContext<ErpCashCuenta>();

  return (
    <div className="min-w-0">
      <div className="font-medium">{cuenta?.tipo?.trim() || "-"}</div>
      <div className="whitespace-normal break-words text-muted-foreground">
        {cuenta?.descripcion?.trim() || "-"}
      </div>
    </div>
  );
};

const UnmappedToggleButton = () => {
  const { displayedFilters, filterValues, setFilters } = useListContext();
  const isUnmapped = filterValues.cuenta_cash_id__is === "null";
  const selectedCashAccount = filterValues.cuenta_cash_id;

  useEffect(() => {
    if (!isUnmapped || selectedCashAccount == null || selectedCashAccount === "") return;
    const nextFilters = { ...filterValues };
    delete nextFilters.cuenta_cash_id__is;
    setFilters(nextFilters, displayedFilters);
  }, [displayedFilters, filterValues, isUnmapped, selectedCashAccount, setFilters]);

  const handleToggle = () => {
    const nextFilters = { ...filterValues };
    if (isUnmapped) {
      delete nextFilters.cuenta_cash_id__is;
    } else {
      delete nextFilters.cuenta_cash_id;
      nextFilters.cuenta_cash_id__is = "null";
    }
    setFilters(nextFilters, displayedFilters);
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={isUnmapped ? "default" : "outline"}
      aria-pressed={isUnmapped}
      onClick={handleToggle}
      className="h-7 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs"
    >
      <Unlink className="size-3.5" />
      Sin mapeo
    </Button>
  );
};

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" />
    <UnmappedToggleButton />
    <CreateButton label="Crear" />
    <ExportButton label="Exportar" />
  </div>
);

export const ErpCashPendientesInputList = () => (
  <List
    resource="erp/cash/pendientes-input"
    title="Pendientes Cash"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={25}
    pagination={<ListPaginator />}
    sort={{ field: "uploaded_at", order: "DESC" }}
    containerClassName={LIST_CONTAINER_WIDE}
  >
    <ResponsiveDataTable
      rowClick="edit"
      mobileConfig={{
        primaryField: "nrocomp_raw",
        secondaryFields: [
          "erp_empresa_id",
          "nrocta_raw",
          "cuenta_cash_id",
          "nrosub_raw",
        ],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <TextListColumn source="erp_empresa_id" label="Empresa" className="w-[80px]">
        <ReferenceField source="erp_empresa_id" reference="erp/empresas" link={false}>
          <ListText source="empresa_nombre" />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="nrocomp_raw" label="Comprob." className="w-[170px]">
        <ComprobanteField />
      </TextListColumn>
      <TextListColumn source="nrocta_raw" label="Cuenta" className="w-[110px]">
        <CuentaField />
      </TextListColumn>
      <TextListColumn source="cuenta_cash_id" label="Cuenta Cash" className="w-[140px]">
        <ReferenceField
          source="cuenta_cash_id"
          reference="erp/cash/cuentas"
          link={false}
          empty="-"
        >
          <CuentaCashField />
        </ReferenceField>
      </TextListColumn>
      <TextListColumn source="nrosub_raw" label="Subcuenta" className="w-[150px]">
        <SubcuentaField />
      </TextListColumn>
      <TextListColumn source="fecvenc_raw" label="Vencimiento" className="w-[95px]">
        <ListText source="fecvenc_raw" />
      </TextListColumn>
      <TextListColumn source="saldo_raw" label="Saldo" className="w-[100px]">
        <ListText source="saldo_raw" className="tabular-nums" />
      </TextListColumn>
      <BooleanListColumn source="is_valid" label="Válido" className="w-[62px]" />
      <TextListColumn label="Acciones" className="w-[56px]">
        <FormOrderListRowActions showShow={false} />
      </TextListColumn>
    </ResponsiveDataTable>
  </List>
);

export default ErpCashPendientesInputList;
