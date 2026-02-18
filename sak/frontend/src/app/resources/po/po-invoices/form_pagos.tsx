"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useResourceContext,
} from "ra-core";
import { CreditCard } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FormDialog } from "@/components/forms/form-dialog";
import { formatCurrency } from "@/lib/formatters";
import {
  SectionBaseTemplate,
  FormDate,
  FormSelect,
  useRowActionDialog,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";

import type { PoInvoiceFormValues } from "./model";

type PagosFormValues = {
  fecha_vencimiento?: string | null;
  metodo_pago_id?: number | string | null;
  fecha_pago?: string | null;
};

const normalizeDate = (value?: string | null) =>
  value && String(value).trim() !== "" ? String(value) : null;

const normalizeId = (value?: number | string | null) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "0") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const FormPagos = ({
  disabled,
  visible = true,
}: {
  disabled?: boolean;
  visible?: boolean;
}) => {
  const record = useRecordContext<
    PoInvoiceFormValues & {
      id?: number;
      proveedor?: { nombre?: string };
    }
  >();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const resource = useResourceContext() ?? "po-invoices";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRowActionDialog();

  const defaultValues = useMemo<PagosFormValues>(
    () => ({
      fecha_vencimiento: record?.fecha_vencimiento ?? null,
      metodo_pago_id: (record as any)?.metodo_pago_id ?? null,
      fecha_pago: (record as any)?.fecha_pago ?? null,
    }),
    [record],
  );

  const form = useForm<PagosFormValues>({
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, form, defaultValues]);

  const proveedorLabel =
    record?.proveedor?.nombre ??
    (record as any)?.proveedor_nombre ??
    (record?.proveedor_id ? `#${record.proveedor_id}` : "Sin proveedor");

  const totalLabel = useMemo(
    () => formatCurrency(Number(record?.total ?? 0)),
    [record?.total],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!record?.id) return;
    setLoading(true);
    try {
      await dataProvider.update(resource, {
        id: record.id,
        data: {
          fecha_vencimiento: normalizeDate(values.fecha_vencimiento),
          metodo_pago_id: normalizeId(values.metodo_pago_id),
          fecha_pago: normalizeDate(values.fecha_pago),
        },
        previousData: record,
      });
      notify("Condicion de pago actualizada", { type: "info" });
      refresh();
      setOpen(false);
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la condicion de pago", { type: "warning" });
    } finally {
      setLoading(false);
    }
  });

  if (!record?.id || !visible) return null;

  const content = (
    <>
      <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-[10px] sm:text-xs">
        <div>
          <span className="font-semibold text-foreground">Proveedor:</span>{" "}
          {proveedorLabel}
        </div>
        <div>
          <span className="font-semibold text-foreground">Titulo:</span>{" "}
          {record?.titulo ?? "-"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Total:</span>{" "}
          {totalLabel}
        </div>
      </div>
      <FormProvider {...form}>
        <SectionBaseTemplate
          title="Pago"
          main={
            <div className="grid gap-2 md:grid-cols-3">
              <FormDate
                source="fecha_vencimiento"
                label="Fecha vencimiento"
                widthClass="w-full"
              />
              <ReferenceInput source="metodo_pago_id" reference="metodos-pago">
                <FormSelect
                  optionText="nombre"
                  label="Metodo de pago"
                  widthClass="w-full"
                  emptyText="Sin metodo"
                />
              </ReferenceInput>
              <FormDate
                source="fecha_pago"
                label="Fecha pago"
                widthClass="w-full"
              />
            </div>
          }
          defaultOpen
        />
      </FormProvider>
    </>
  );

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.stopPropagation();
          if (disabled || loading) return;
          if (dialog) {
            dialog.openDialog({
              title: "Editar pago",
              content,
              confirmLabel: "Guardar",
              confirmColor: "primary",
              onConfirm: handleSubmit,
            });
            return;
          }
          setOpen(true);
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
        disabled={disabled || loading}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <CreditCard className="mr-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5" />
        Editar pago
      </DropdownMenuItem>
      {!dialog ? (
        <FormDialog
          open={open}
          onOpenChange={(nextOpen) => setOpen(nextOpen)}
          title="Editar pago"
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          submitLabel="Guardar"
          isSubmitting={loading}
          compact
        >
          {content}
        </FormDialog>
      ) : null}
    </>
  );
};
