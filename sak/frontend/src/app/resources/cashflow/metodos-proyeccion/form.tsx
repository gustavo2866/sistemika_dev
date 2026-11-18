"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { required, useSourceContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";

import { Confirm } from "@/components/confirm";
import { FormOrderToolbar } from "@/components/forms";
import {
  DetailFieldCell,
  FORM_FIELD_READONLY_CLASS,
  FormBoolean,
  FormErrorSummary,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailTemplate2,
  type SectionDetailColumn,
  type SectionDetailFieldsProps,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/simple-form";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TIPO_CALCULO_CHOICES,
  FUNCION_PROYECCION_CHOICES,
  METODO_PROYECCION_DEFAULTS,
  getMetodoProyeccionDetalleDefaults,
  getMesBaseChoices,
  getMesBaseRangeDescription,
  metodoProyeccionSchema,
  metodoProyeccionDefaultSchema,
  applyMetodoProyeccionDefaults,
  type FuncionProyeccion,
  type MetodoProyeccionFormValues,
} from "./model";

const detalleColumns: SectionDetailColumn[] = [
  { label: "Mes destino", width: "100px" },
  { label: "Base desde", width: "minmax(160px,1fr)", mobileSpan: "full" },
  { label: "Base hasta", width: "minmax(160px,1fr)", mobileSpan: "full" },
  { label: "Función", width: "150px", mobileSpan: "full" },
  { label: "Factor", width: "100px" },
  { label: "", width: "minmax(64px,1fr)" },
];

const getDefaultYearDetails = () =>
  Array.from({ length: 12 }, (_, index) => ({
    mes_destino: index + 1,
    mes_base_desde: -1,
    mes_base_hasta: -1,
    funcion: "ULTIMO" as const,
    factor: 1,
  }));

const GenerateDefaultDetailsButton = ({ disabled }: { disabled: boolean }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { setValue } = useFormContext<MetodoProyeccionFormValues>();

  const handleConfirm = () => {
    setValue("detalles", getDefaultYearDetails(), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConfirmOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        className="gap-2 text-[9px] sm:text-[10px]"
        disabled={disabled}
        onSelect={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
        Generar default
      </DropdownMenuItem>
      <Confirm
        isOpen={confirmOpen}
        title="Generar configuración por defecto"
        content="Se eliminará la configuración actual y se generarán los doce meses. ¿Deseas continuar?"
        confirmColor="warning"
        onConfirm={handleConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
};

const ApplyDefaultDetailsMenuItem = ({ disabled }: { disabled: boolean }) => {
  const [open, setOpen] = useState(false);
  const [funcion, setFuncion] = useState<FuncionProyeccion>("ULTIMO");
  const [factor, setFactor] = useState("1");
  const { getValues, setValue } = useFormContext<MetodoProyeccionFormValues>();
  const detalles = useWatch<MetodoProyeccionFormValues, "detalles">({ name: "detalles" }) ?? [];
  const validation = metodoProyeccionDefaultSchema.safeParse({ funcion, factor });
  const factorError = validation.success ? undefined
    : validation.error.issues.find((issue) => issue.path[0] === "factor")?.message;

  const handleConfirm = () => {
    if (disabled || !validation.success) return;
    setValue("detalles", applyMetodoProyeccionDefaults(getValues("detalles") ?? [], validation.data), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        className="gap-2 text-[9px] sm:text-[10px]"
        disabled={disabled || !detalles.length}
        onSelect={(event) => {
          event.preventDefault();
          const first = getValues("detalles")?.[0];
          setFuncion(first?.funcion ?? "ULTIMO");
          setFactor(String(first?.factor ?? 1));
          setOpen(true);
        }}
      >
        Aplicar default
      </DropdownMenuItem>
      <Confirm
        isOpen={open}
        title="Aplicar default"
        content={
          <div className="space-y-4">
            <DialogDescription>
              La función y el factor se aplicarán a las {detalles.length} reglas existentes.
            </DialogDescription>
            <div className="space-y-1">
              <Label htmlFor="reglas-default-funcion">Función</Label>
              <Select value={funcion} onValueChange={(value) => setFuncion(value as FuncionProyeccion)}>
                <SelectTrigger id="reglas-default-funcion" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNCION_PROYECCION_CHOICES.map((choice) => <SelectItem key={choice.id} value={choice.id}>{choice.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reglas-default-factor">Factor</Label>
              <Input id="reglas-default-factor" inputMode="decimal" value={factor}
                onChange={(event) => setFactor(event.target.value)} aria-invalid={Boolean(factorError)}
                aria-describedby={factorError ? "reglas-default-factor-error" : undefined} />
              {factorError && <p id="reglas-default-factor-error" className="text-sm text-destructive">{factorError}</p>}
            </div>
          </div>
        }
        confirm="Aplicar"
        cancel="Cancelar"
        confirmDisabled={disabled || !detalles.length || !validation.success}
        onConfirm={handleConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

const MetodoProyeccionDetalleFields = ({ isActive }: SectionDetailFieldsProps) => {
  const { getSource } = useSourceContext();
  const [month, from, to] = useWatch({
    name: [getSource("mes_destino"), getSource("mes_base_desde"), getSource("mes_base_hasta")],
  }).map(Number);
  const choices = useMemo(() => getMesBaseChoices(from, to), [from, to]);
  const weighted = useWatch({ name: getSource("funcion") }) === "AJUSTE_PONDERADO";
  const description = getMesBaseRangeDescription(month, from, to);

  return (
    <>
      <HiddenInput source="version" />
      <DetailFieldCell label="Mes destino" data-focus-field="true">
        <FormNumber
          source="mes_destino"
          label={false}
          min={1}
          max={12}
          step={1}
          validate={required()}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Base desde">
        <FormSelect
          source="mes_base_desde"
          label={false}
          choices={choices}
          emptyText="Seleccionar período"
          disableClear
          parse={(value) => value === "" ? null : Number(value)}
          validate={required()}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Base hasta">
        <FormSelect
          source="mes_base_hasta"
          label={false}
          choices={choices}
          emptyText="Seleccionar período"
          disableClear
          parse={(value) => value === "" ? null : Number(value)}
          validate={required()}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Función">
        <FormSelect
          source="funcion"
          label={false}
          choices={FUNCION_PROYECCION_CHOICES}
          emptyText="Sin función"
          widthClass="w-full"
          className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
        />
      </DetailFieldCell>
      <DetailFieldCell label="Factor">
        <FormText
          source="factor"
          label={false}
          inputMode="decimal"
          format={(value) => value == null ? "" : String(value)}
          validate={required()}
          widthClass="w-full"
          readOnly={!isActive}
          className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
        />
      </DetailFieldCell>
      {isActive && description ? (
        <p className="col-span-full order-1 text-xs text-muted-foreground" aria-live="polite">
          {description}
          {weighted && " Ajuste ponderado toma el último mes base: incorpora el desvío real solo si está cerrado. Factor entre 0 y 1; por ejemplo, 0,2 incorpora el 20 % del desvío."}
        </p>
      ) : null}
    </>
  );
};

const CalculationType = () => {
  const kind = useWatch({ name: "tipo_calculo" });
  const label = TIPO_CALCULO_CHOICES.find((choice) => choice.id === kind)?.name ?? "Histórico";
  return <div className="flex items-center gap-1 whitespace-nowrap text-xs">
    <HiddenInput source="tipo_calculo" />
    <span className="text-muted-foreground">Tipo de cálculo:</span>
    <output className="font-medium" aria-label="Tipo de cálculo">{label}</output>
  </div>;
};

const HistoricalRules = ({ disabled, onActiveRowChange }: { disabled: boolean; onActiveRowChange: (index: number | null) => void }) => {
  const kind = useWatch({ name: "tipo_calculo" });
  const { setValue } = useFormContext<MetodoProyeccionFormValues>();
  useEffect(() => {
    if (kind && kind !== "HISTORICO") {
      setValue("detalles", []);
      onActiveRowChange(null);
    }
  }, [kind, setValue, onActiveRowChange]);
  if (kind !== "HISTORICO") return null;
  return <SectionDetailTemplate2
    title="Reglas de cálculo" detailsSource="detalles" mainColumns={detalleColumns}
    mainFields={MetodoProyeccionDetalleFields} defaults={getMetodoProyeccionDetalleDefaults}
    addButtonLabel="Agregar regla" onActiveRowChange={onActiveRowChange}
    actions={<>
      <GenerateDefaultDetailsButton disabled={disabled} />
      <ApplyDefaultDetailsMenuItem disabled={disabled} />
    </>} />;
};

export const MetodoProyeccionForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof routeReturnTo === "string" ? routeReturnTo : undefined;
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);
  const handleActiveRowChange = useCallback(
    (index: number | null) => setActiveDetailIndex(index),
    [],
  );
  return (
      <SimpleForm<MetodoProyeccionFormValues>
        className="w-full max-w-5xl"
        resolver={zodResolver(metodoProyeccionSchema) as any}
        toolbar={
          <FormOrderToolbar
            cancelProps={returnTo ? { onClick: () => navigate(returnTo) } : undefined}
            saveProps={{ disabled: activeDetailIndex != null }}
          />
        }
        defaultValues={METODO_PROYECCION_DEFAULTS}
      >
        <FormErrorSummary />
        <SectionBaseTemplate
          title="Método de proyección"
          main={
            <div className="grid gap-2 md:grid-cols-2">
              <FormText
                source="nombre"
                label="Nombre"
                validate={required()}
                autoFocus
                widthClass="w-full"
                maxLength={200}
              />
              <div className="flex h-8 items-center gap-4 md:self-end">
                <FormBoolean source="activo" label="Activo" defaultValue />
                <CalculationType />
              </div>
              <FormTextarea
                source="descripcion"
                label="Descripción"
                widthClass="w-full md:col-span-2"
                maxLength={1000}
                rows={3}
              />
              <HiddenInput source="version" />
            </div>
          }
          defaultOpen
        />
        <HistoricalRules disabled={activeDetailIndex != null} onActiveRowChange={handleActiveRowChange} />
      </SimpleForm>
  );
};
