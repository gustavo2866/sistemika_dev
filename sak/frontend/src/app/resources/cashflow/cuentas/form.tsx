"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { Calculator, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateButton } from "@/components/create-button";
import type { MetodoProyeccion } from "../metodos-proyeccion/model";
import { ErpCashMapList } from "../maps/list";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormNumber,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CASH_CUENTA_DEFAULT,
  ERP_CASH_CUENTA_TIPO_CHOICES,
  erpCashCuentaSchema,
  normalizeErpCashCuentaTipo,
  type ErpCashCuentaFormValues,
  type ErpCashCuenta,
} from "./model";

const CashAccountMappings = () => {
  const record = useRecordContext<ErpCashCuenta>();
  const location = useLocation();
  return (
    <SectionBaseTemplate
      title="Mapeo"
      defaultOpen
      headerSummary={record?.id != null ? (
        <CreateButton
          label="Agregar mapeo"
          resource="erp/cash/maps"
          to="/cashflow/setup/mapas/create"
          className="h-9 gap-2 px-4 text-xs sm:h-9 sm:px-4 sm:text-xs [&_svg]:size-4"
          state={{
            record: { map_debe_id: Number(record.id) },
            returnTo: `${location.pathname}${location.search}`,
          }}
        />
      ) : undefined}
      main={record?.id != null ? (
        <ErpCashMapList
          embedded
          cuentaCashId={record.id}
          returnTo={`${location.pathname}${location.search}`}
          rowClick={(id: number | string) => `/cashflow/setup/mapas/edit/${id}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
        />
      ) : <p className="text-sm text-muted-foreground">Guardá la cuenta para consultar sus mapeos.</p>}
    />
  );
};

const ProjectionMethodField = () => {
  const methodId = useWatch({ name: "id_metodo_proyeccion" });
  const navigate = useNavigate();
  const location = useLocation();
  const openMethod = (view: "create" | "edit") => {
    const path = view === "create" ? "create" : `edit/${methodId}`;
    navigate(`/cashflow/setup/metodos-proyeccion/${path}`, {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

  return (
    <div className="flex w-full items-start gap-2 [&_[data-slot=form-description]]:text-[10px] [&_[data-slot=form-description]]:leading-tight">
      <div className="min-w-0 flex-1">
        <FormReferenceAutocomplete
          referenceProps={{ source: "id_metodo_proyeccion", reference: "metodos-proyeccion", filter: { activo: true } }}
          inputProps={{ optionText: "nombre", label: "Método de proyección", helperText: "Método utilizado para proyectar esta cuenta Cash" }}
          widthClass="w-full"
        />
      </div>
      <Button type="button" variant="outline" size="icon" className="mt-3.5 size-8 shrink-0" onClick={() => openMethod("create")} aria-label="Crear método de proyección" title="Crear método de proyección">
        <Plus className="size-3.5" />
      </Button>
      <Button type="button" variant="outline" size="icon" className="mt-3.5 size-8 shrink-0" onClick={() => openMethod("edit")} disabled={!methodId} aria-label="Editar método de proyección" title="Editar método de proyección">
        <Calculator className="size-3.5" />
      </Button>
    </div>
  );
};

const RelationalFields = () => {
  const methodId = useWatch({ name: "id_metodo_proyeccion" });
  const { data: method, isPending } = useGetOne<MetodoProyeccion>("metodos-proyeccion", { id: methodId }, { enabled: !!methodId });
  const { setValue } = useFormContext<ErpCashCuentaFormValues>();
  const kind = methodId && String(method?.id) === String(methodId) ? method?.tipo_calculo : undefined;
  useEffect(() => {
    if (methodId && !kind) return;
    setValue("tipo_calculo_metodo", kind ?? "");
    if (kind !== "RELACIONAL") {
      setValue("cuenta_cash_referencia_id", undefined);
      setValue("porcentaje", undefined);
    }
  }, [kind, methodId, setValue]);
  if (isPending || kind !== "RELACIONAL") return null;
  return <>
    <FormReferenceAutocomplete
      referenceProps={{ source: "cuenta_cash_referencia_id", reference: "erp/cash/cuentas" }}
      inputProps={{ optionText: "descripcion", label: "Cuenta Cash de referencia", validate: required(), helperText: "Usa el proyectado de esta cuenta del mismo mes" }}
      widthClass="w-full" />
    <FormNumber source="porcentaje" label="Porcentaje (%)" step={0.000001} validate={required()} widthClass="w-full" helperText="5 significa 5 % del proyectado de la cuenta de referencia" />
  </>;
};

export const ErpCashCuentaForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo
    ?? new URLSearchParams(location.search).get("returnTo");
  const returnTo = typeof routeReturnTo === "string" ? routeReturnTo : undefined;
  return (
  <SimpleForm<ErpCashCuentaFormValues>
    className="w-full max-w-none"
    resolver={zodResolver(erpCashCuentaSchema) as any}
    toolbar={<FormOrderToolbar cancelProps={returnTo ? { onClick: () => navigate(returnTo) } : undefined} />}
    defaultValues={ERP_CASH_CUENTA_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos de la cuenta Cash"
      main={
        <div className="flex flex-col gap-3">
          <FormText source="descripcion" label="Descripción" validate={required()} widthClass="w-full" maxLength={255} />
          <FormSelect
            source="tipo"
            label="Tipo"
            choices={ERP_CASH_CUENTA_TIPO_CHOICES}
            emptyText="Sin definir"
            format={normalizeErpCashCuentaTipo}
            widthClass="w-full"
          />
          <ProjectionMethodField />
          <RelationalFields />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
    <CashAccountMappings />
  </SimpleForm>
  );
};
