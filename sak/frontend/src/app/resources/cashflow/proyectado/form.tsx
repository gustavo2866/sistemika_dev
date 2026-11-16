"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne } from "ra-core";
import { useWatch } from "react-hook-form";
import type { MetodoProyeccion } from "../metodos-proyeccion/model";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import {
  ERP_CASH_PROYECTADO_DEFAULT,
  getTotalProyectado,
  erpCashProyectadoSchema,
  type ErpCashProyectadoFormValues,
} from "./model";

const ProjectionTotalPreview = () => {
  const [accountId, selectedMethodId, projected, pending, committed] = useWatch({
    name: ["cuenta_cash_id", "id_metodo_proyeccion", "importe_proyectado", "importe_pendiente", "importe_comprometido"],
  });
  const account = useGetOne<{ id: number; id_metodo_proyeccion?: number | null }>(
    "erp/cash/cuentas", { id: accountId }, { enabled: Boolean(accountId) },
  );
  const methodId = selectedMethodId || account.data?.id_metodo_proyeccion;
  const method = useGetOne<MetodoProyeccion>(
    "metodos-proyeccion", { id: methodId ?? "" }, { enabled: Boolean(methodId) },
  );
  const loading = account.isLoading || (Boolean(methodId) && method.isLoading);
  const total = getTotalProyectado(method.data?.tipo_calculo ?? "HISTORICO", Number(projected || 0), Number(pending || 0), Number(committed || 0));
  return (
    <div className="text-sm" aria-live="polite">
      <div className="font-medium">Total proyectado</div>
      <div>{loading ? "Cargando…" : new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}</div>
    </div>
  );
};

export const ErpCashProyectadoForm = () => (
  <SimpleForm<ErpCashProyectadoFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(erpCashProyectadoSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ERP_CASH_PROYECTADO_DEFAULT}
  >
    <SectionBaseTemplate
      title="Datos del valor proyectado"
      main={
        <div className="grid gap-2 md:grid-cols-2">
          <FormReferenceAutocomplete
            referenceProps={{ source: "cuenta_cash_id", reference: "erp/cash/cuentas" }}
            inputProps={{ optionText: "descripcion", label: "Cuenta financiera", validate: required() }}
            widthClass="w-full"
          />
          <FormDate
            source="fecha_periodo"
            label="Período"
            validate={required()}
            helperText="Seleccionar el primer día del mes"
            widthClass="w-full"
          />
          <FormReferenceAutocomplete
            referenceProps={{ source: "id_metodo_proyeccion", reference: "metodos-proyeccion" }}
            inputProps={{ optionText: "nombre", label: "Método aplicado", helperText: "Si no se indica, se usa el método de la cuenta" }}
            widthClass="w-full md:col-span-2"
          />
          <FormNumber source="importe_proyectado" label="Proyectado" validate={required()} step={0.01} widthClass="w-full" helperText="Los cambios manuales se conservan al reconstruir Cash." />
          <FormNumber source="importe_pendiente" label="Pendiente" validate={required()} step={0.01} widthClass="w-full" />
          <FormNumber source="importe_comprometido" label="Comprometido" validate={required()} step={0.01} widthClass="w-full" />
          <ProjectionTotalPreview />
          <FormTextarea
            source="observacion"
            label="Observación"
            maxLength={255}
            widthClass="w-full md:col-span-2"
          />
          <HiddenInput source="version" />
        </div>
      }
      defaultOpen
    />
  </SimpleForm>
);
