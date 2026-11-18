"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { required, useGetList, useRecordContext } from "ra-core";

import { FormOrderToolbar } from "@/components/forms";
import { FormReferenceAutocomplete, FormSelect, HiddenInput, SectionBaseTemplate } from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import type { ErpCuenta } from "../../erp/cuentas/model";
import { ERP_CASH_MAP_DEFAULT, erpCashMapSchema, type ErpCashMap, type ErpCashMapFormValues } from "./model";

export const ErpCashMapForm = () => {
  const record = useRecordContext<ErpCashMap>();
  const currencies = useGetList<{ id: number; codigo: string; nombre: string }>("monedas", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "codigo", order: "ASC" },
    filter: {},
  });
  const currencyChoices = useMemo(() => {
    const choices = new Map(
      (currencies.data ?? []).map((currency) => [
        currency.codigo,
        { id: currency.codigo, name: `${currency.codigo} — ${currency.nombre}` },
      ]),
    );
    const currentCurrency = record?.moneda ?? ERP_CASH_MAP_DEFAULT.moneda;
    if (currentCurrency && !choices.has(currentCurrency)) {
      choices.set(currentCurrency, { id: currentCurrency, name: currentCurrency });
    }
    return [...choices.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [currencies.data, record?.moneda]);
  const accounts = useGetList<ErpCuenta>("erp/cuentas", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "nro_cuenta", order: "ASC" },
    filter: {},
  });
  const categories = useGetList<{ id: string; name: string }>("erp/cash/maps/categorias", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
    filter: {},
  });
  const accountChoices = useMemo(() => {
    const choices = new Map<number, { id: number; name: string }>();
    for (const account of accounts.data ?? []) {
      if (account.nro_cuenta == null || account.nro_cuenta === "") continue;
      const id = Number(account.nro_cuenta);
      if (!Number.isInteger(id) || id < 0 || choices.has(id)) continue;
      choices.set(id, { id, name: `${id} — ${account.descripcion || account.cod_cuenta || "Sin descripción"}` });
    }
    if (record?.nro_cta != null && !choices.has(record.nro_cta)) {
      choices.set(record.nro_cta, {
        id: record.nro_cta,
        name: record.cuenta_nombre ? `${record.nro_cta} — ${record.cuenta_nombre}` : String(record.nro_cta),
      });
    }
    return [...choices.values()].sort((a, b) => a.id - b.id);
  }, [accounts.data, record?.nro_cta, record?.cuenta_nombre]);
  const categoryChoices = useMemo(() => {
    const choices = new Map((categories.data ?? []).map((category) => [category.id, category]));
    if (record?.categoria && !choices.has(record.categoria)) {
      choices.set(record.categoria, { id: record.categoria, name: record.categoria });
    }
    return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categories.data, record?.categoria]);

  return (
    <SimpleForm<ErpCashMapFormValues>
      className="w-full max-w-2xl"
      resolver={zodResolver(erpCashMapSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={ERP_CASH_MAP_DEFAULT}
    >
      <SectionBaseTemplate
        title="Datos del mapeo Cash"
        main={
          <div className="grid gap-2 md:grid-cols-2">
            <FormSelect
              source="nro_cta"
              label="Cuenta ERP"
              choices={accountChoices}
              validate={required()}
              isPending={accounts.isPending}
              disabled={Boolean(accounts.error)}
              helperText={accounts.error ? "No se pudieron cargar las cuentas ERP" : undefined}
              emptyText="Seleccionar cuenta ERP"
              disableClear
              parse={(value) => value === "" ? undefined : Number(value)}
              widthClass="w-full"
            />
            <FormSelect
              source="moneda"
              label="Moneda"
              choices={currencyChoices}
              validate={required()}
              isPending={currencies.isPending}
              disabled={Boolean(currencies.error)}
              helperText={currencies.error ? "No se pudieron cargar las monedas" : undefined}
              emptyText="Seleccionar moneda"
              disableClear
              widthClass="w-full"
            />
            <FormSelect
              source="categoria"
              label="Categoría"
              choices={categoryChoices}
              isPending={categories.isPending}
              disabled={Boolean(categories.error)}
              helperText={categories.error ? "No se pudieron cargar las categorías" : undefined}
              emptyText="Sin categoría"
              widthClass="w-full"
            />
            <div />
            <FormReferenceAutocomplete
              referenceProps={{ source: "map_debe_id", reference: "erp/cash/cuentas" }}
              inputProps={{ optionText: "descripcion", label: "Mapeo Debe", validate: required() }}
              widthClass="w-full"
            />
            <FormReferenceAutocomplete
              referenceProps={{ source: "map_haber_id", reference: "erp/cash/cuentas" }}
              inputProps={{ optionText: "descripcion", label: "Mapeo Haber", validate: required() }}
              widthClass="w-full"
            />
            <HiddenInput source="version" />
          </div>
        }
        defaultOpen
      />
    </SimpleForm>
  );
};
