"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  type Identifier,
  required,
  useCreatePath,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useResourceContext,
  useSimpleFormIteratorItem,
} from "ra-core";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormState, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import { Loading } from "@/components/loading";
import { NumberField } from "@/components/number-field";
import {
  CalculatedImporte,
  DetailFooterButtons,
  DetailIterator,
  DetailRowActions,
  DetailRowProvider,
  FORM_VALUE_READONLY_CLASS,
  FORM_FIELD_READONLY_CLASS,
  ResponsiveDetailRow,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailTemplate,
  TotalCompute,
  useDetailSectionContext,
} from "@/components/forms/form_order";
import { FormOrderToolbar } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { Confirm } from "@/components/confirm";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import {
  computeDetalleImporte,
  computePoOrderTotal,
  poOrderSchema,
} from "./model";
import type { PoOrderFormValues } from "./model";
import {
  useCentroCostoOportunidadExclusion,
  useDetalleCentroCostoOportunidadExclusion,
  usePoOrderDefaults,
  useTipoSolicitudChangeGuard,
} from "./form_hooks";

// PoOrderForm: SimpleForm wrapper with validation resolver and custom toolbar.
export const PoOrderForm = () => {
  const record = useRecordContext<PoOrderFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const identityResponse = useGetIdentity();
  const identity =
    (identityResponse as { data?: any; identity?: any }).data ??
    (identityResponse as { identity?: any }).identity;
  const identityId = useMemo(() => {
    const raw = identity?.id;
    if (raw == null || raw === "") return undefined;
    const parsed = typeof raw === "string" ? Number(raw) : raw;
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [identity?.id]);

  const isIdentityLoading = Boolean(
    (identityResponse as { isLoading?: boolean }).isLoading,
  );

  if (isCreate && isIdentityLoading && identityId == null) {
    return <Loading delay={200} />;
  }

  const defaultValues = useMemo(
    () => (isCreate && identityId != null ? { solicitante_id: identityId } : undefined),
    [isCreate, identityId],
  );

  return (
    <SimpleForm<PoOrderFormValues>
      className="w-full max-w-3xl"
      // ra-core FormProps types resolver as Resolver<FieldValues>
      resolver={zodResolver(poOrderSchema) as any}
      toolbar={<FormOrderToolbar />}
      defaultValues={defaultValues}
    >
      <PoOrderFormFields />
    </SimpleForm>
  );
};

// PoOrderFormFields: renders header + detail sections and the change guard.
const PoOrderFormFields = () => {
  usePoOrderDefaults();
  useCentroCostoOportunidadExclusion();
  useDetalleCentroCostoOportunidadExclusion();
  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =
    useTipoSolicitudChangeGuard();

  return (
    <>
      <FormErrorSummary />

      <HeaderSection />

      <DetailSection articuloFilter={articuloFilter} />

      <Confirm
        isOpen={confirmOpen}
        title="Cambiar tipo de solicitud"
        content="Esto limpiará los artículos seleccionados. ¿Deseas continuar?"
        onConfirm={confirmChange}
        onClose={cancelChange}
      />
    </>
  );
};

// HeaderSection: wraps header template and composes main + optional fields.
const HeaderSection = () => {
  const record = useRecordContext<PoOrderFormValues & { id?: Identifier }>();
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
      const previousData = record as PoOrderFormValues & { id: Identifier };
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
        className="gap-2 text-[9px] sm:text-[10px]"
      >
        <Eye className="h-3 w-3" />
        Preview
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => setConfirmDelete(true)}
        className="gap-2 text-[9px] sm:text-[10px]"
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
            {/* Always compute total for validation/payload */}
            <TotalCompute computeTotal={computePoOrderTotal} />
            <HiddenInput source="total" />
            <HiddenInput source="tipo_compra" />
            <HiddenInput source="order_status_id" />
            <HiddenInput source="departamento_id" />
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

// HeaderMainFields: required header inputs.
const HeaderMainFields = () => {
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <FormText
          source="titulo"
          label="Titulo"
          validate={required()}
          widthClass="w-full md:w-[220px]"
        />
        <FormReferenceAutocomplete
          referenceProps={{ source: "solicitante_id", reference: "users" }}
          inputProps={{
            optionText: "nombre",
            label: "Solicitante",
            validate: required(),
          }}
          widthClass="w-full md:w-[200px]"
        />
        <div className="w-full md:w-[200px]">
          <ReferenceInput
            source="tipo_solicitud_id"
            reference="tipos-solicitud"
          >
            <FormSelect
              optionText="nombre"
              label="Tipo solicitud"
              validate={required()}
              widthClass="w-full"
            />
          </ReferenceInput>
        </div>
        <div className="relative w-full md:w-[200px]">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "proveedor_id",
              reference: "proveedores",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Proveedor",
            }}
            widthClass="w-full"
          />
        </div>
      </div>
    </div>
  );
};

// HeaderOptionalFields: optional header fields block with subtle panel styling.
const HeaderOptionalFields = () => {
  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-4">
          <FormDate
            source="fecha_necesidad"
            label="Fecha necesidad"
            widthClass="w-full"
          />
          <FormReferenceAutocomplete
            referenceProps={{
              source: "centro_costo_id",
              reference: "centros-costo",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Centro de costo",
            }}
            widthClass="w-full"
          />
          <FormReferenceAutocomplete
            referenceProps={{
              source: "oportunidad_id",
              reference: "crm/oportunidades",
            }}
            inputProps={{
              optionText: "titulo",
              label: "Oportunidad",
            }}
            widthClass="w-full"
          />
          <ReferenceInput
            source="metodo_pago_id"
            reference="metodos-pago"
          >
            <FormSelect
              optionText="nombre"
              label="Metodo de pago"
              widthClass="w-full"
            />
          </ReferenceInput>
          <FormTextarea
            source="comentario"
            label="Comentario"
            widthClass="w-full"
            className="md:col-span-4 [&_textarea]:min-h-[64px]"
          />
        </div>
      </div>
    </div>
  );
};


// DetailSection: wraps detail template and its list + header actions.
const DetailSection = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const total = useWatch({ name: "total" }) as number | undefined;
  const totalValue = Number(total ?? 0);
  const detailDefaults = useMemo(
    () => ({
      articulo_id: "",
      descripcion: "",
      unidad_medida: "",
      centro_costo_id: "",
      oportunidad_id: "",
      cantidad: 1,
      precio: 0,
      importe: 0,
    }),
    [],
  );
  const columns = [
    { label: "Articulo" },
    { label: "Descripcion" },
    { label: "Cantidad", className: "-ml-[15px]" },
    { label: "Precio", className: "ml-[0px]" },
    { label: "Importe", className: "ml-[30px]" },
    { label: "" },
  ];

  const totalSummary = (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase text-muted-foreground">Total</span>
      <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-semibold text-foreground">
        <NumberField
          source="total"
          record={{ total: totalValue }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="tabular-nums"
        />
      </span>
    </div>
  );

  return (
    <SectionDetailTemplate
      title="Detalle"
      columns={columns}
      columnsClassName="grid-cols-[220px_150px_64px_84px_84px_28px]"
      headerSummary={totalSummary}
      headerSummaryClassName="mr-10"
      defaultDetailValues={detailDefaults}
      list={
        <DetailList
          articuloFilter={articuloFilter}
          defaultDetailValues={detailDefaults}
        />
      }
    />
  );
};

// DetailList: detail list container with labels, scrolling and add behavior.
const DetailList = ({
  articuloFilter,
  defaultDetailValues,
}: {
  articuloFilter?: Record<string, unknown>;
  defaultDetailValues?: Record<string, unknown>;
}) => {
  const detailContext = useDetailSectionContext();
  if (!detailContext) {
    throw new Error("DetailList must be used within SectionDetailTemplate");
  }
  const { containerRef, activeIndex, onContainerClick, onRowClick, setActiveIndex } =
    detailContext;

  return (
    <div
      className="mt-1 space-y-0 w-full"
      onClick={onContainerClick}
    >
      <div
        ref={containerRef}
        className="w-full rounded-md border border-border p-2 md:max-h-64 md:overflow-y-auto"
      >
        <ArrayInput source="detalles" label={false}>
          <DetailIterator
            addButton={
              <DetailFooterButtons defaultValues={defaultDetailValues} />
            }
          >
            <DetailItemRow
              articuloFilter={articuloFilter}
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

// DetailItemRow: single detail row with click-to-edit and compact layout.
const DetailItemRow = ({
  articuloFilter,
  activeIndex,
  onRowClick,
  setActiveIndex,
}: {
  articuloFilter?: Record<string, unknown>;
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
      <ResponsiveDetailRow className={rowClassName} onClick={onRowClick(index)}>
        <div className="grid grid-cols-1 gap-1 sm:flex sm:flex-row sm:items-center sm:gap-2">
          <HiddenInput source="id" />
          <div
            className="col-span-1 w-full sm:col-auto sm:w-[220px] shrink-0"
            data-articulo-field="true"
          >
            <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
              Articulo
            </div>
            <div className="grid grid-cols-[1fr_16px] items-center gap-0.5 sm:block">
              <div className="flex-1">
                <FormReferenceAutocomplete
                  referenceProps={{
                    source: "articulo_id",
                    reference: "articulos",
                    filter: articuloFilter,
                  }}
                  inputProps={{
                    optionText: "nombre",
                    label: false,
                  }}
                  widthClass="w-full"
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
            </div>
          </div>
          <FormText
            source="descripcion"
            label={false}
            widthClass="w-full sm:w-[130px] shrink-0"
            readOnly={!isActive}
            className={cn("hidden sm:block", !isActive && FORM_FIELD_READONLY_CLASS)}
          />
          <div className="col-span-1 grid grid-cols-[1fr_auto] gap-1 sm:contents">
            <div className="grid grid-cols-[36px_58px_64px] gap-1 sm:flex sm:items-center sm:gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Cant.
                </div>
                <FormNumber
                  source="cantidad"
                  label={false}
                  inputMode="decimal"
                  step="0.001"
                  widthClass="w-[36px] sm:w-[80px] shrink-0"
                  readOnly={!isActive}
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Precio
                </div>
                <FormNumber
                  source="precio"
                  label={false}
                  inputMode="decimal"
                  step="0.01"
                  widthClass="w-[58px] sm:w-[84px] shrink-0"
                  readOnly={!isActive}
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="sm:hidden text-[8px] font-semibold text-muted-foreground leading-none">
                  Importe
                </div>
                <CalculatedImporte
                  computeImporte={computeDetalleImporte}
                  widthClass="w-[64px] sm:w-[84px] shrink-0"
                  valueClassName={
                    !isActive
                      ? FORM_VALUE_READONLY_CLASS
                      : undefined
                  }
                />
                <HiddenInput source="importe" />
              </div>
            </div>
            <DetailRowActions />
          </div>
        </div>
        <DetailOptionalFields showOptional={showOptional} isActive={isActive} />
        <div className="mt-0 pt-0 flex justify-end gap-1 sm:hidden" />
      </ResponsiveDetailRow>
    </DetailRowProvider>
  );
};

// DetailOptionalFields: extra detail fields shown per-row when expanded.
const DetailOptionalFields = ({
  showOptional,
  isActive,
}: {
  showOptional: boolean;
  isActive: boolean;
}) => {
  return (
    <div className="w-full">
      {showOptional ? (
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 md:grid-cols-[210px_210px] md:justify-start">
            <FormText
              source="descripcion"
              label="Descripcion"
              widthClass="w-full"
              readOnly={!isActive}
              className={cn("sm:hidden", !isActive && FORM_FIELD_READONLY_CLASS)}
            />
            <ReferenceInput
              source="centro_costo_id"
              reference="centros-costo"
            >
              <FormSelect
                optionText="nombre"
                label="Centro de costo"
                widthClass="w-full sm:w-[210px]"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
            <ReferenceInput
              source="oportunidad_id"
              reference="crm/oportunidades"
            >
              <FormSelect
                optionText="titulo"
                label="Oportunidad"
                widthClass="w-full sm:w-[210px]"
                className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
              />
            </ReferenceInput>
          </div>
        </div>
      ) : null}
    </div>
  );
};
