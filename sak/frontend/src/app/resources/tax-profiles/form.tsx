"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  type Identifier,
  required,
  useCreatePath,
  useDataProvider,
  useNotify,
  useRecordContext,
  useResourceContext,
  useSimpleFormIteratorItem,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormState } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  DetailFooterButtons,
  DetailIterator,
  DetailRowActions,
  DetailRowProvider,
  FORM_FIELD_READONLY_CLASS,
  FormBoolean,
  FormDate,
  FormNumber,
  FormSelect,
  FormText,
  FormTextarea,
  FormReferenceAutocomplete,
  HiddenInput,
  ResponsiveDetailRow,
  SectionBaseTemplate,
  SectionDetailTemplate,
  useDetailSectionContext,
} from "@/components/forms/form_order";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { Confirm } from "@/components/confirm";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { taxProfileSchema } from "./model";
import type { TaxProfileFormValues } from "./model";

export const TaxProfileForm = () => {
  const record = useRecordContext<TaxProfileFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;

  const defaultValues = useMemo(() => {
    if (!isCreate) return undefined;
    return {
      activo: true,
    };
  }, [isCreate]);

  return (
    <SimpleForm<TaxProfileFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(taxProfileSchema) as any}
      toolbar={<TaxProfileFormToolbar />}
      defaultValues={defaultValues}
    >
      <TaxProfileFormFields />
    </SimpleForm>
  );
};

const TaxProfileFormToolbar = () => (
  <div className="flex w-full items-center justify-end gap-2">
    <FormOrderCancelButton />
    <FormOrderSaveButton variant="secondary" />
  </div>
);

const TaxProfileFormFields = () => {
  return (
    <>
      <FormErrorSummary />
      <HeaderSection />
      <DetailSection />
    </>
  );
};

const formatDateValue = (value: unknown) => {
  if (!value) return "";
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
};

const HeaderSection = () => {
  const record = useRecordContext<TaxProfileFormValues & { id?: Identifier }>();
  const resource = useResourceContext();
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasRecord = Boolean(record?.id && resource);

  const handlePreview = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!record?.id || !resource) return;
    navigate(createPath({ resource, type: "show", id: record.id }));
  };

  const handleDelete = async () => {
    if (!record || !record.id || !resource || deleting) return;
    setDeleting(true);
    try {
      const previousData = record as TaxProfileFormValues & { id: Identifier };
      await dataProvider.delete(resource, {
        id: record.id,
        previousData,
      });
      notify("Registro eliminado", { type: "info" });
      navigate(createPath({ resource, type: "list" }));
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar", { type: "warning" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const headerActions = hasRecord ? (
    <>
      <DropdownMenuItem
        onClick={handlePreview}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
      >
        <Eye className="h-3 w-3" />
        Preview
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => setConfirmDelete(true)}
        className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
        variant="destructive"
      >
        <Trash2 className="h-3 w-3" />
        Eliminar
      </DropdownMenuItem>
    </>
  ) : null;

  return (
    <>
      <SectionBaseTemplate
        title="Cabecera"
        main={
          <>
            <HeaderMainFields />
            <HiddenInput source="activo" />
          </>
        }
        actions={headerActions}
        optional={<HeaderOptionalFields />}
      />
      <Confirm
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar registro"
        content="Seguro que deseas eliminar este registro?"
        confirmColor="warning"
        loading={deleting}
      />
    </>
  );
};

const HeaderMainFields = () => {
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <FormText
          source="nombre"
          label="Nombre"
          validate={required()}
          widthClass="w-full md:w-[260px]"
        />
        <FormBoolean source="activo" label="Activo" />
      </div>
    </div>
  );
};

const HeaderOptionalFields = () => {
  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-4">
          <FormTextarea
            source="descripcion"
            label="Descripcion"
            widthClass="w-full"
            className="md:col-span-4 [&_textarea]:min-h-[64px]"
          />
        </div>
      </div>
    </div>
  );
};

const DetailSection = () => {
  const detailDefaults = useMemo(
    () => ({
      concepto_id: "",
      porcentaje: 0,
      descripcion: "",
      activo: true,
      fecha_vigencia: "",
    }),
    [],
  );

  const columns = [
    { label: "Concepto" },
    { label: "%", className: "text-right -translate-x-[50px]" },
    { label: "Vigencia", className: "text-right -translate-x-[40px]" },
    { label: "Activo", className: "text-right -translate-x-[30px]" },
    { label: "" },
  ];

  return (
    <SectionDetailTemplate
      title="Detalle"
      detailsSource="details"
      columns={columns}
      columnsClassName="grid-cols-[220px_80px_110px_70px_28px]"
      defaultDetailValues={detailDefaults}
      list={<DetailList defaultDetailValues={detailDefaults} />}
    />
  );
};

const DetailList = ({
  defaultDetailValues,
}: {
  defaultDetailValues?: Record<string, unknown>;
}) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("DetailList must be used within SectionDetailTemplate");
  }
  const { containerRef, activeIndex, onContainerClick, onRowClick, setActiveIndex } =
    detailContext;

  return (
    <div className="mt-1 space-y-0 w-full" onClick={onContainerClick}>
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-64 md:overflow-y-auto"
      >
        <ArrayInput source="details" label={false}>
          <DetailIterator
            addButton={<DetailFooterButtons defaultValues={defaultDetailValues} />}
          >
            <DetailItemRow
              activeIndex={activeIndex}
              onRowClick={onRowClick}
              setActiveIndex={setActiveIndex}
            />
          </DetailIterator>
        </ArrayInput>
      </div>
    </div>
  );
};

const DetailItemRow = ({
  activeIndex,
  onRowClick,
  setActiveIndex,
}: {
  activeIndex: number | null;
  onRowClick: (index: number) => (event: MouseEvent) => void;
  setActiveIndex: (index: number | null) => void;
}) => {
  const [showOptional, setShowOptional] = useState(false);
  const { remove, index } = useSimpleFormIteratorItem();
  const isActive = activeIndex === index;
  const handleCollapse = () => {
    setShowOptional(false);
    setActiveIndex(null);
  };
  const toggleOptional = () => setShowOptional((prev) => !prev);
  useEffect(() => {
    if (!isActive && showOptional) {
      setShowOptional(false);
    }
  }, [isActive, showOptional]);

  const rowClassName = cn(
    isActive
      ? "border-primary/30 bg-primary/5 sm:border sm:border-primary/30 sm:bg-primary/5 sm:rounded-md sm:p-2"
      : "sm:border-transparent",
  );

  return (
    <DetailRowProvider
      value={{
        isActive,
        showOptional,
        toggleOptional,
        collapse: handleCollapse,
        remove,
      }}
    >
      <ResponsiveDetailRow
        className={rowClassName}
        onClick={onRowClick(index)}
        onFocusCapture={() => setActiveIndex(index)}
      >
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-2">
          <HiddenInput source="id" />
          <div
            className="col-span-1 w-full sm:col-auto sm:w-[220px] shrink-0"
            data-focus-field="true"
          >
            <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
              Concepto
            </div>
            <FormReferenceAutocomplete
              referenceProps={{
                source: "concepto_id",
                reference: "api/v1/adm/conceptos",
                filter: { es_impuesto: true },
              }}
              inputProps={{
                optionText: "nombre",
                label: false,
              }}
              widthClass="w-full"
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </div>
          <FormNumber
            source="porcentaje"
            label={false}
            inputMode="decimal"
            step="0.01"
            widthClass="w-[60px] sm:w-[60px] shrink-0"
            readOnly={!isActive}
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
          />
          <FormDate
            source="fecha_vigencia"
            label={false}
            widthClass="w-[110px] sm:w-[110px] shrink-0"
            readOnly={!isActive}
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            format={formatDateValue}
          />
          <FormBoolean
            source="activo"
            label={false}
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
          />
          <DetailRowActions />
        </div>
        {showOptional ? (
          <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
            <FormText
              source="descripcion"
              label="Descripcion"
              widthClass="w-full"
              readOnly={!isActive}
              className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
            />
          </div>
        ) : null}
        <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
      </ResponsiveDetailRow>
    </DetailRowProvider>
  );
};

const FormErrorSummary = () => {
  const { errors, submitCount } = useFormState();
  const firstError = useMemo(
    () => (submitCount > 0 ? getFirstError(errors) : undefined),
    [errors, submitCount],
  );

  if (!firstError) return null;

  const pathLabel = firstError.path.length
    ? `${firstError.path.join(".")}: `
    : "";

  return (
    <div className="text-[10px] text-destructive">
      {pathLabel}
      {firstError.message}
    </div>
  );
};

const getFirstError = (
  errors: unknown,
  path: string[] = [],
): { path: string[]; message: string } | undefined => {
  if (!errors || typeof errors !== "object") return undefined;
  const errorAny = errors as {
    message?: unknown;
    root?: { message?: unknown };
    [key: string]: unknown;
  };
  if (typeof errorAny.message === "string" && errorAny.message.trim()) {
    return { path, message: errorAny.message };
  }
  if (typeof errorAny.root?.message === "string" && errorAny.root.message.trim()) {
    return { path, message: errorAny.root.message };
  }
  for (const key of Object.keys(errorAny)) {
    if (key === "ref" || key === "type" || key === "types") continue;
    const child = errorAny[key];
    const nested = getFirstError(child, [...path, key]);
    if (nested) return nested;
  }
  return undefined;
};
