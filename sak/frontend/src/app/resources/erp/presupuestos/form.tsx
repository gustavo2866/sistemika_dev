"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDownToLine, BarChart3, DollarSign, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormValue,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { FORM_FIELD_LABEL_CLASS } from "@/components/forms/form_order/form/field_styles";
import { SimpleForm } from "@/components/simple-form";
import { cn } from "@/lib/utils";

import {
  ERP_PRESUPUESTO_DEFAULT,
  erpPresupuestoSchema,
  type ErpPresupuesto,
  type ErpPresupuestoFormValues,
} from "./model";
import { MovimientosDialog } from "./panel/MovimientosDialog";
import type { MovimientoRequest, MovimientoResponse } from "./panel/types";
import {
  buildMovimientosUrl,
  fetchJsonWithAuth,
} from "./panel/utils";

type ErpPresupuestoFormProps = {
  initialValues?: Partial<ErpPresupuestoFormValues>;
  onCancel?: () => void;
};

type ErpCuenta = {
  id?: number | string;
  cod_cuenta?: string | null;
  descripcion?: string | null;
  rubro?: {
    id?: number | string;
    nombre?: string | null;
  } | null;
};

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const parseDateParam = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;

const parsePeriodParam = (value: string | null) =>
  value && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : undefined;

const normalizeRubroName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const formatMoneyInput = (value: unknown) =>
  moneyFormatter.format(Number(value ?? 0));

const parseMoneyInput = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCuentaChoice = (cuenta?: ErpCuenta | null) =>
  [cuenta?.cod_cuenta, cuenta?.descripcion].filter(Boolean).join(" - ");

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const formatPercentValue = (value: number | null) =>
  value === null ? "-" : `${percentFormatter.format(value)}%`;

const getVariationPercent = (real: number, budget: number) => {
  if (budget === 0) return real === 0 ? 0 : null;
  return ((real - budget) / Math.abs(budget)) * 100;
};

const getMarginPercent = (result: number, income: number) => {
  if (income === 0) return result === 0 ? 0 : null;
  return (result / income) * 100;
};

const getSignedColorClass = (value: number | null) => {
  if (value === null) return "text-muted-foreground";
  return value < 0 ? "text-rose-700" : "text-emerald-700";
};

const METRIC_FIELDS_CLASS = "flex flex-wrap items-start gap-2";
const METRIC_FIELD_WIDTH_CLASS = "w-[156px] max-w-full min-w-0";
const METRIC_NARROW_WIDTH_CLASS = "w-[116px] max-w-full min-w-0";
const METRIC_SMALL_WIDTH_CLASS = "w-[86px] max-w-full min-w-0";

const ReadonlyMetric = ({
  label,
  value,
  detail,
  title,
  className,
  widthClass = METRIC_FIELD_WIDTH_CLASS,
  valueClassName,
  detailClassName,
}: {
  label?: string | false;
  value: string;
  detail?: string;
  title?: string;
  className?: string;
  widthClass?: string;
  valueClassName?: string;
  detailClassName?: string;
}) => (
  <FormValue
    label={label}
    widthClass={widthClass}
    valueClassName={cn("justify-end tabular-nums", className)}
  >
    <span
      className={cn(
        "grid w-full min-w-0 items-baseline gap-1",
        detail ? "grid-cols-[minmax(0,1fr)_30px]" : "grid-cols-[minmax(0,1fr)]",
      )}
      title={title ?? [value, detail].filter(Boolean).join(" ")}
    >
      <span className={cn("min-w-0 truncate text-right", valueClassName)}>{value}</span>
      {detail ? (
        <span className={cn("min-w-0 truncate text-right text-[7px] leading-none", detailClassName)}>
          {detail}
        </span>
      ) : null}
    </span>
  </FormValue>
);

const SectionTitleWithIcon = ({
  title,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
}) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-md text-white",
        iconClassName,
      )}
    >
      <Icon className="size-3" />
    </span>
    <span>{title}</span>
  </span>
);

const RubroCuentaDefaults = () => {
  const record = useRecordContext<ErpPresupuesto>();
  const { getValues, setValue } = useFormContext<ErpPresupuestoFormValues>();
  const rubroId = record?.erp_cuenta?.rubro?.id;

  useEffect(() => {
    if (!rubroId || getValues("rubro_id")) return;
    setValue("rubro_id", Number(rubroId), { shouldDirty: false });
  }, [getValues, rubroId, setValue]);

  return null;
};

const RubroAutocomplete = () => {
  const { setValue } = useFormContext<ErpPresupuestoFormValues>();
  return (
    <FormReferenceAutocomplete
      referenceProps={{
        source: "rubro_id",
        reference: "erp/rubros",
        filter: { activo: true },
      }}
      inputProps={{
        optionText: "nombre",
        label: "Rubro",
        placeholder: "Selecciona un rubro",
        optionFilter: (choice) => normalizeRubroName(choice?.nombre) !== "ingresos",
        onSelectionChange: () => {
          setValue("erp_cuenta_id", undefined as unknown as number, {
            shouldDirty: true,
            shouldValidate: true,
          });
        },
      }}
      widthClass="w-full"
    />
  );
};

const CuentaAutocomplete = () => {
  const { control } = useFormContext<ErpPresupuestoFormValues>();
  const rubroValue = useWatch({ control, name: "rubro_id" });
  const rubroId = rubroValue ? Number(rubroValue) : undefined;
  const cuentaFilter = useMemo(
    () => ({
      activo: true,
      ...(rubroId ? { rubro_id: rubroId } : {}),
    }),
    [rubroId],
  );

  return (
    <FormReferenceAutocomplete
      referenceProps={{
        source: "erp_cuenta_id",
        reference: "erp/cuentas",
        filter: cuentaFilter,
      }}
      inputProps={{
        optionText: formatCuentaChoice,
        inputText: formatCuentaChoice,
        label: "Cuenta ERP",
        placeholder: rubroId ? "Selecciona una cuenta" : "Selecciona un rubro primero",
        validate: required(),
        disabled: !rubroId,
      }}
      widthClass="w-full"
    />
  );
};

const PresupuestoCabeceraFields = () => {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <RubroCuentaDefaults />
      <FormReferenceAutocomplete
        referenceProps={{ source: "proyecto_id", reference: "proyectos" }}
        inputProps={{
          optionText: "nombre",
          label: "Proyecto",
          validate: required(),
        }}
        widthClass="w-full"
      />
      <FormDate
        source="fecha"
        label="Fecha"
        validate={required()}
        widthClass="w-full"
      />
      <RubroAutocomplete />
      <CuentaAutocomplete />
    </div>
  );
};

const IngresosFields = () => {
  const record = useRecordContext<ErpPresupuesto>();
  const { control } = useFormContext<ErpPresupuestoFormValues>();
  const [ingres, realIngreso] = useWatch({
    control,
    name: ["ingres", "real_ingreso"],
  });
  const isIngresoRubro =
    normalizeRubroName(record?.erp_cuenta?.rubro?.nombre) === "ingresos";
  const variation = getVariationPercent(Number(realIngreso ?? 0), Number(ingres ?? 0));
  const variationAmount = Number(realIngreso ?? 0) - Number(ingres ?? 0);

  return (
    <div className={METRIC_FIELDS_CLASS}>
      <FormNumber
        source="real_ingreso"
        label="Real"
        min={0}
        step="0.01"
        disabled={isIngresoRubro}
        format={formatMoneyInput}
        parse={parseMoneyInput}
        widthClass={METRIC_FIELD_WIDTH_CLASS}
      />
      <FormNumber
        source="ingres"
        label="Presupuestado"
        min={0}
        step="0.01"
        format={formatMoneyInput}
        parse={parseMoneyInput}
        widthClass={METRIC_FIELD_WIDTH_CLASS}
      />
      <ReadonlyMetric
        label="Variacion"
        value={formatMoneyInput(variationAmount)}
        detail={formatPercentValue(variation)}
        className={getSignedColorClass(variation)}
        widthClass={METRIC_NARROW_WIDTH_CLASS}
        valueClassName="text-[8px] sm:text-[9px]"
        detailClassName="text-[6.5px]"
      />
    </div>
  );
};

const EgresosFields = () => {
  const record = useRecordContext<ErpPresupuesto>();
  const { control } = useFormContext<ErpPresupuestoFormValues>();
  const [fecha, proyectoId, erpCuentaId, rubroId, egreso, realEgreso] = useWatch({
    control,
    name: ["fecha", "proyecto_id", "erp_cuenta_id", "rubro_id", "egreso", "real_egreso"],
  });
  const [movimientosRequest, setMovimientosRequest] =
    useState<MovimientoRequest | null>(null);
  const {
    data: movimientosData,
    isLoading: movimientosLoading,
    isError: movimientosError,
  } = useQuery({
    queryKey: ["erp-presupuesto-form-movimientos", movimientosRequest],
    queryFn: () =>
      fetchJsonWithAuth<MovimientoResponse>(
        buildMovimientosUrl(movimientosRequest as MovimientoRequest),
      ),
    enabled: Boolean(movimientosRequest),
  });
  const period = typeof fecha === "string" && fecha.length >= 7 ? fecha.slice(0, 7) : "";
  const canOpenMovimientos =
    Boolean(period) && Number(proyectoId) > 0 && Number(erpCuentaId) > 0;
  const variation = getVariationPercent(Number(realEgreso ?? 0), Number(egreso ?? 0));
  const variationAmount = Number(realEgreso ?? 0) - Number(egreso ?? 0);

  const openEgresoMovimientos = () => {
    if (!canOpenMovimientos) return;
    const projectLabel =
      record?.proyecto?.nombre || (proyectoId ? `Proyecto #${proyectoId}` : "Proyecto");
    const cuentaLabel =
      formatCuentaChoice(record?.erp_cuenta) ||
      (erpCuentaId ? `Cuenta #${erpCuentaId}` : "Cuenta");

    setMovimientosRequest({
      month: period,
      proyecto_id: Number(proyectoId),
      rubro_id: rubroId ? Number(rubroId) : undefined,
      erp_cuenta_id: Number(erpCuentaId),
      concepto: "egreso",
      conceptoLabel: "Egreso",
      label: `${projectLabel} - ${cuentaLabel}`,
    });
  };

  return (
    <>
      <div className={METRIC_FIELDS_CLASS}>
        <div className={cn("grid gap-[1px] sm:gap-[2px]", METRIC_FIELD_WIDTH_CLASS)}>
          <div className="flex items-center gap-0.5">
            <span className={FORM_FIELD_LABEL_CLASS}>Real</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-3 w-3 rounded-sm border border-sky-200 bg-sky-50 p-0 text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900 focus-visible:ring-1 focus-visible:ring-sky-300 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
              disabled={!canOpenMovimientos}
              title={
                canOpenMovimientos
                  ? "Consultar movimientos reales de egresos"
                  : "Selecciona proyecto, cuenta y periodo"
              }
              aria-label="Consultar movimientos reales de egresos"
              onClick={openEgresoMovimientos}
            >
              <Eye className="size-2.5" />
            </Button>
          </div>
          <FormNumber
            source="real_egreso"
            label={false}
            min={0}
            step="0.01"
            disabled
            format={formatMoneyInput}
            parse={parseMoneyInput}
            widthClass={METRIC_FIELD_WIDTH_CLASS}
            className="[&_input:disabled]:!border [&_input:disabled]:!border-input [&_input:disabled]:!bg-background [&_input:disabled]:!shadow-xs"
          />
        </div>
        <FormNumber
          source="egreso"
          label="Presupuestado"
          min={0}
          step="0.01"
          format={formatMoneyInput}
          parse={parseMoneyInput}
          widthClass={METRIC_FIELD_WIDTH_CLASS}
        />
        <ReadonlyMetric
          label="Variacion"
          value={formatMoneyInput(variationAmount)}
          detail={formatPercentValue(variation)}
          className={getSignedColorClass(variation)}
          widthClass={METRIC_NARROW_WIDTH_CLASS}
          valueClassName="text-[8px] sm:text-[9px]"
          detailClassName="text-[6.5px]"
        />
        <FormNumber
          source="obreros_cantidad"
          label="Obreros"
          min={0}
          step="0.01"
          widthClass={METRIC_SMALL_WIDTH_CLASS}
        />
        <FormNumber
          source="obreros_costo"
          label="Costo obreros"
          min={0}
          step="0.01"
          format={formatMoneyInput}
          parse={parseMoneyInput}
          widthClass={METRIC_NARROW_WIDTH_CLASS}
        />
      </div>
      <MovimientosDialog
        request={movimientosRequest}
        data={movimientosData}
        isLoading={movimientosLoading}
        isError={movimientosError}
        onOpenChange={(open) => {
          if (!open) setMovimientosRequest(null);
        }}
      />
    </>
  );
};

const ResultadoFields = () => {
  const { control } = useFormContext<ErpPresupuestoFormValues>();
  const [ingres, egreso, realIngreso, realEgreso] = useWatch({
    control,
    name: ["ingres", "egreso", "real_ingreso", "real_egreso"],
  });
  const realResult = Number(realIngreso ?? 0) - Number(realEgreso ?? 0);
  const budgetResult = Number(ingres ?? 0) - Number(egreso ?? 0);
  const realMargin = getMarginPercent(realResult, Number(realIngreso ?? 0));
  const budgetMargin = getMarginPercent(budgetResult, Number(ingres ?? 0));

  return (
    <div className={METRIC_FIELDS_CLASS}>
      <ReadonlyMetric
        label="Real"
        value={formatMoneyInput(realResult)}
        detail={formatPercentValue(realMargin)}
        className={realResult < 0 ? "text-rose-700" : "text-foreground"}
        detailClassName={getSignedColorClass(realMargin)}
      />
      <ReadonlyMetric
        label="Presup."
        value={formatMoneyInput(budgetResult)}
        detail={formatPercentValue(budgetMargin)}
        className={budgetResult < 0 ? "text-rose-700" : "text-foreground"}
        detailClassName={getSignedColorClass(budgetMargin)}
      />
    </div>
  );
};

export const ErpPresupuestoForm = ({
  initialValues,
  onCancel,
}: ErpPresupuestoFormProps = {}) => {
  const record = useRecordContext<ErpPresupuestoFormValues & { id?: number | string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");
  const proyectoIdFromQuery = parseNumericParam(params.get("proyecto_id"));
  const rubroIdFromQuery = parseNumericParam(params.get("rubro_id"));
  const erpCuentaIdFromQuery = parseNumericParam(params.get("erp_cuenta_id"));
  const fechaFromQuery =
    parseDateParam(params.get("fecha")) ?? parsePeriodParam(params.get("periodo"));

  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            ...ERP_PRESUPUESTO_DEFAULT,
            fecha: fechaFromQuery ?? ERP_PRESUPUESTO_DEFAULT.fecha,
            proyecto_id: proyectoIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.proyecto_id,
            rubro_id: rubroIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.rubro_id,
            erp_cuenta_id: erpCuentaIdFromQuery ?? ERP_PRESUPUESTO_DEFAULT.erp_cuenta_id,
            ...initialValues,
          },
    [
      erpCuentaIdFromQuery,
      fechaFromQuery,
      initialValues,
      proyectoIdFromQuery,
      record?.id,
      rubroIdFromQuery,
    ],
  );

  return (
    <SimpleForm<ErpPresupuestoFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(erpPresupuestoSchema) as any}
      toolbar={
        <FormOrderToolbar
          cancelProps={
            onCancel
              ? {
                  onClick: onCancel,
                }
              : returnTo
              ? {
                  onClick: () => navigate(returnTo, { replace: true }),
                }
              : undefined
          }
        />
      }
      defaultValues={defaultValues}
    >
      <SectionBaseTemplate
        title="Cabecera"
        main={<PresupuestoCabeceraFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title={
          <SectionTitleWithIcon
            title="Ingresos"
            icon={DollarSign}
            iconClassName="bg-emerald-600"
          />
        }
        ariaTitle="Ingresos"
        main={<IngresosFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title={
          <SectionTitleWithIcon
            title="Egresos"
            icon={ArrowDownToLine}
            iconClassName="bg-rose-600"
          />
        }
        ariaTitle="Egresos"
        main={<EgresosFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title={
          <SectionTitleWithIcon
            title="Resultado"
            icon={BarChart3}
            iconClassName="bg-indigo-700"
          />
        }
        ariaTitle="Resultado"
        main={<ResultadoFields />}
        defaultOpen
      />
    </SimpleForm>
  );
};
