"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { required, useGetList, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { FormOrderToolbar } from "@/components/forms";
import { FormNumber, FormSelect, FormText, HiddenInput, SectionBaseTemplate } from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { ERP_CASH_SUBCTA_DEFAULT, ERP_CASH_SUBCTA_ESTADO_CHOICES, erpCashSubctaSchema, type ErpCashSubcta, type ErpCashSubctaFormValues } from "./model";

const CategorySelect = ({ choices, isPending, error }: {
  choices: { id: string; name: string }[];
  isPending: boolean;
  error: boolean;
}) => {
  const { setValue } = useFormContext<ErpCashSubctaFormValues>();
  const estado = useWatch<ErpCashSubctaFormValues>({ name: "estado" });
  return (
    <FormSelect
      source="categoria"
      label="Categoría"
      choices={choices}
      isPending={isPending}
      disabled={error}
      helperText={error ? "No se pudieron cargar las categorías" : undefined}
      emptyText="Sin categoría"
      onSelectionChange={(value) => {
        if (value && estado === "error") setValue("estado", "activa", { shouldDirty: true, shouldValidate: true });
      }}
      widthClass="w-full"
    />
  );
};

export const ErpCashSubctaForm = ({ onCancel }: { onCancel?: () => void } = {}) => {
  const record = useRecordContext<ErpCashSubcta>();
  const categories = useGetList<{ id: string; name: string }>("erp/cash/maps/categorias", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
    filter: {},
  });
  const categoryChoices = useMemo(() => {
    const choices = new Map((categories.data ?? [])
      .filter((category) => category.id.trim().toLowerCase() !== "error")
      .map((category) => [category.id, category]));
    if (record?.categoria && !choices.has(record.categoria)) {
      choices.set(record.categoria, { id: record.categoria, name: record.categoria });
    }
    return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categories.data, record?.categoria]);

  return (
    <SimpleForm<ErpCashSubctaFormValues>
      className="w-full max-w-2xl"
      resolver={zodResolver(erpCashSubctaSchema) as any}
      toolbar={<FormOrderToolbar cancelProps={onCancel ? { onClick: onCancel } : undefined} />}
      defaultValues={ERP_CASH_SUBCTA_DEFAULT}
    >
      <SectionBaseTemplate
        title="Datos de la subcuenta Cash"
        main={
          <div className="grid gap-2 md:grid-cols-2">
            <FormNumber source="tpo_subcta" label="Tipo de subcuenta" validate={required()} min={0} step={1} widthClass="w-full" />
            <FormNumber source="nro_subcta" label="Número de subcuenta" validate={required()} min={0} step={1} widthClass="w-full" />
            <FormText source="descripcion" label="Descripción" validate={required()} widthClass="w-full" maxLength={255} />
            <FormSelect source="estado" label="Estado" choices={ERP_CASH_SUBCTA_ESTADO_CHOICES} validate={required()} disableClear widthClass="w-full" />
            <CategorySelect
              choices={categoryChoices}
              isPending={categories.isPending}
              error={Boolean(categories.error)}
            />
            <HiddenInput source="version" />
          </div>
        }
        defaultOpen
      />
    </SimpleForm>
  );
};
