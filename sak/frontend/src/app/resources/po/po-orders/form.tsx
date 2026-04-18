"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type Identifier,
  required,
  useRecordContext,
  useGetOne,
  useWrappedSource,
} from "ra-core";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation } from "react-router-dom";

import { SimpleForm } from "@/components/simple-form";
import { Loading } from "@/components/loading";
import { NumberField } from "@/components/number-field";
import {
  CalculatedImporte,
  DetailFieldCell,
  FormErrorSummary,
  FORM_VALUE_READONLY_CLASS,
  FORM_FIELD_READONLY_CLASS,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  FormOrderHeaderMenuActions,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  TotalCompute,
  ArchivoViewerModal,
  resolveNumericId,
} from "@/components/forms/form_order";
import { FormOrderCancelButton, FormOrderSaveButton } from "@/components/forms";
import { ReferenceInput } from "@/components/reference-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import { FileText, Trash2, Upload } from "lucide-react";
import { apiUrl } from "@/lib/dataProvider";

import {
  computeDetalleImporte,
  computePoOrderTotal,
  getPoOrderDetalleDefaults,
  isPoOrderLocked,
  poOrderSchema,
  TIPO_COMPRA_CHOICES,
} from "./model";
import type { PoOrderFormValues } from "./model";
import {
  type PoOrderRecord,
  useAccionesCabeceraOrden,
  usePoOrderFormDefaults,
  usePoOrderDefaults,
  useSolicitanteCentroCostoSync,
  usePoOrderReadOnly,
  usePoOrderArchivoUpload,
  usePoOrderArchivoDelete,
} from "./form_hooks";
import {
  useCentroCostoOportunidadExclusion,
  useDetalleCentroCostoOportunidadExclusion,
  useTipoSolicitudChangeGuard,
} from "../shared/po-hooks";
import { FormGenerar } from "./form_generar";

const PoOrderDetailEditContext = createContext<{
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
} | null>(null);

const usePoOrderDetailEdit = () => useContext(PoOrderDetailEditContext);

type PoOrderExternalLockState = {
  lockOportunidad: boolean;
  lockCentro: boolean;
  lockedOportunidadId?: number;
  lockedCentroId?: number;
};

const PoOrderExternalLockContext = createContext<PoOrderExternalLockState>({
  lockOportunidad: false,
  lockCentro: false,
});

const usePoOrderExternalLock = () => useContext(PoOrderExternalLockContext);

const parseNumericParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const PoOrderExternalLockSync = () => {
  const { lockCentro, lockOportunidad, lockedOportunidadId, lockedCentroId } =
    usePoOrderExternalLock();
  const { setValue } = useFormContext<PoOrderFormValues>();
  const oportunidadValue = useWatch({ name: "oportunidad_id" }) as unknown;
  const centroValue = useWatch({ name: "centro_costo_id" }) as unknown;

  useEffect(() => {
    if (!lockOportunidad || !lockedOportunidadId) return;
    const current = resolveNumericId(oportunidadValue);
    if (current === lockedOportunidadId) return;
    setValue("oportunidad_id", lockedOportunidadId, { shouldDirty: true });
  }, [lockOportunidad, lockedOportunidadId, oportunidadValue, setValue]);

  useEffect(() => {
    if (!lockCentro || !lockedCentroId) return;
    const current = resolveNumericId(centroValue);
    if (current === lockedCentroId) return;
    setValue("centro_costo_id", lockedCentroId, { shouldDirty: true });
  }, [lockCentro, lockedCentroId, centroValue, setValue]);

  return null;
};

// === Formulario principal ===
// Renderiza el formulario principal de Orden de compra.
export const PoOrderForm = () => {
  const record = useRecordContext<PoOrderRecord>();
  const { defaultValues, isLoadingDefaults } = usePoOrderFormDefaults();
  const [isEditing, setIsEditing] = useState(false);
  const location = useLocation();
  const isCreate = !record?.id;
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const lockedOportunidadId = useMemo(
    () => parseNumericParam(search.get("oportunidad_id")),
    [search],
  );
  const lockedCentroId = useMemo(
    () => parseNumericParam(search.get("centro_costo_id")),
    [search],
  );
  const lockOportunidad = isCreate && (search.get("lock_oportunidad") === "1" || lockedOportunidadId != null);
  const lockCentro = isCreate && (search.get("lock_centro") === "1");

  const mergedDefaultValues = useMemo(() => {
    if (!isCreate) return defaultValues;
    if (!defaultValues && !lockedOportunidadId && !lockedCentroId) return defaultValues;
    return {
      ...(defaultValues ?? {}),
      ...(lockedOportunidadId ? { oportunidad_id: lockedOportunidadId } : {}),
      ...(lockedCentroId ? { centro_costo_id: lockedCentroId } : {}),
    };
  }, [defaultValues, isCreate, lockedCentroId, lockedOportunidadId]);

  const lockState = useMemo(
    () => ({
      lockOportunidad,
      lockCentro,
      lockedOportunidadId,
      lockedCentroId,
    }),
    [lockCentro, lockOportunidad, lockedCentroId, lockedOportunidadId],
  );

    if (isLoadingDefaults) {
      return <Loading delay={200} />;
    }

    return (
      <PoOrderDetailEditContext.Provider value={{ isEditing, setIsEditing }}>
        <PoOrderExternalLockContext.Provider value={lockState}>
          <SimpleForm<PoOrderFormValues>
            className="w-full max-w-3xl"
            // ra-core FormProps types resolver as Resolver<FieldValues>
            resolver={zodResolver(poOrderSchema) as any}
            toolbar={<OrdenCompraToolbar />}
            defaultValues={mergedDefaultValues}
          >
            <PoOrderExternalLockSync />
            <OrdenCompraContenido />
          </SimpleForm>
        </PoOrderExternalLockContext.Provider>
      </PoOrderDetailEditContext.Provider>
    );
};

// Barra de acciones del formulario de Orden de compra.
const OrdenCompraToolbar = () => {
  const record = useRecordContext<PoOrderRecord>();
  const isLocked = isPoOrderLocked(record?.order_status?.nombre);
  const editContext = usePoOrderDetailEdit();
  const disableGenerar = editContext?.isEditing ?? false;
  const isReadOnly = usePoOrderReadOnly();

  return (
    <div className="flex w-full items-center justify-end gap-2">
      <FormOrderCancelButton />
      <FormOrderSaveButton variant="secondary" disabled={isLocked || isReadOnly} />
      {!isLocked ? <FormGenerar disabled={disableGenerar} /> : null}
    </div>
  );
};

// Contenido principal del formulario (cabecera, detalle y totales).
const OrdenCompraContenido = () => {
  usePoOrderDefaults();
  useCentroCostoOportunidadExclusion();
  useDetalleCentroCostoOportunidadExclusion();
  const { articuloFilter, confirmOpen, confirmChange, cancelChange } =
    useTipoSolicitudChangeGuard();
  const record = useRecordContext<PoOrderRecord>();
  const isEdit = Boolean(record?.id);

  return (
    <>
      <FormErrorSummary />

      <CabeceraOrdenCompra />

      <DetalleOrdenCompra articuloFilter={articuloFilter} />

      <ResumenTotalesOrdenCompra />

      {isEdit ? <ArchivosSection record={record} /> : null}

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

// === Seccion cabecera ===
// Seccion de cabecera con campos principales y opcionales.
const CabeceraOrdenCompra = () => {
  const {
    canPreview,
    canDelete,
    onPreview,
    onRequestDelete,
    confirmDelete,
    setConfirmDelete,
    deleting,
    handleDelete,
    isLocked,
  } = useAccionesCabeceraOrden();
  const isReadOnly = usePoOrderReadOnly();
  const accionesMenu =
    canPreview || canDelete ? (
      <FormOrderHeaderMenuActions
        canPreview={canPreview}
        canDelete={canDelete}
        onPreview={onPreview}
        onDelete={onRequestDelete}
      />
    ) : null;

  return (
    <>
    <SectionBaseTemplate
      title="Cabecera"
      readOnly={isReadOnly}
      main={
        <>
          <CabeceraCamposPrincipales />
            {/* Always compute total for validation/payload */}
            <TotalCompute computeTotal={computePoOrderTotal} />
            <HiddenInput source="total" />
            <HiddenInput source="tipo_compra" />
            <HiddenInput source="order_status_id" />
            <HiddenInput source="departamento_id" />
          </>
        }
        actions={accionesMenu}
        optional={<CabeceraCamposOpcionales />}
      />
      {!isLocked ? (
        <Confirm
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          title="Eliminar registro"
          content="Seguro que deseas eliminar este registro?"
          confirmColor="warning"
          loading={deleting}
        />
      ) : null}
    </>
  );
};

// Campos principales de la cabecera de Orden de compra.
const CabeceraCamposPrincipales = () => {
  const record = useRecordContext<PoOrderFormValues & { id?: Identifier }>();
  const isCreate = !record?.id;
  const { handleSolicitanteChange } = useSolicitanteCentroCostoSync();
  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <FormText
          source="titulo"
          label="Titulo"
          validate={required()}
          autoFocus={isCreate}
          widthClass="w-full md:w-[220px]"
        />
        <FormReferenceAutocomplete
          referenceProps={{ source: "solicitante_id", reference: "users" }}
          inputProps={{
            optionText: "nombre",
            label: "Solicitante",
            validate: required(),
            onSelectionChange: handleSolicitanteChange,
          }}
          widthClass="w-full md:w-[200px]"
        />
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
      </div>
    </div>
  );
};

// Campos opcionales de la cabecera con panel secundario.
const CabeceraCamposOpcionales = () => {
  const { lockCentro, lockOportunidad, lockedOportunidadId, lockedCentroId } =
    usePoOrderExternalLock();
  const oportunidadValue = useWatch({ name: "oportunidad_id" }) as unknown;
  const centroValue = useWatch({ name: "centro_costo_id" }) as unknown;
  const departamentoValue = useWatch({ name: "departamento_id" }) as unknown;
  const tipoCompraValue = useWatch({ name: "tipo_compra" }) as
    | "normal"
    | "directa"
    | undefined;

  const resolvedOportunidadId = resolveNumericId(oportunidadValue) ?? lockedOportunidadId;
  const resolvedCentroId = resolveNumericId(centroValue) ?? lockedCentroId;
  const resolvedDepartamentoId = resolveNumericId(departamentoValue);

  const { data: oportunidadLocked } = useGetOne(
    "crm/oportunidades",
    { id: resolvedOportunidadId ?? 0 },
    { enabled: lockOportunidad && Boolean(resolvedOportunidadId) },
  );
  const { data: centroLocked } = useGetOne(
    "centros-costo",
    { id: resolvedCentroId ?? 0 },
    { enabled: lockCentro && Boolean(resolvedCentroId) },
  );
  const { data: departamentoData } = useGetOne(
    "departamentos",
    { id: resolvedDepartamentoId ?? 0 },
    { enabled: Boolean(resolvedDepartamentoId) },
  );

  const oportunidadLabel =
    (oportunidadLocked as any)?.titulo ??
    (oportunidadLocked as any)?.descripcion_estado ??
    (resolvedOportunidadId ? `#${resolvedOportunidadId}` : "Sin oportunidad");
  const centroLabel =
    (centroLocked as any)?.nombre ??
    (resolvedCentroId ? `#${resolvedCentroId}` : "Sin centro de costo");
  const departamentoLabel =
    (departamentoData as any)?.nombre ??
    (resolvedDepartamentoId ? `#${resolvedDepartamentoId}` : "-");
  const tipoCompraLabel =
    TIPO_COMPRA_CHOICES.find((choice) => choice.id === tipoCompraValue)?.name ?? "-";

  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-4">
          <FormValue label="Departamento" widthClass="w-full">
            {departamentoLabel}
          </FormValue>
          <FormValue label="Tipo orden" widthClass="w-full">
            {tipoCompraLabel}
          </FormValue>
          {lockCentro ? (
            <FormValue label="Centro de costo" widthClass="w-full">
              {centroLabel}
            </FormValue>
          ) : (
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
          )}
          {lockOportunidad ? (
            <FormValue label="Oportunidad" widthClass="w-full">
              {oportunidadLabel}
            </FormValue>
          ) : (
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
          )}
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
          <FormDate
            source="fecha_necesidad"
            label="Fecha necesidad"
            widthClass="w-full"
          />
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

// === Seccion detalle ===
// Seccion de detalle con lineas y campos opcionales.
const DetalleOrdenCompra = ({ articuloFilter }: { articuloFilter?: Record<string, unknown> }) => {
  const editContext = usePoOrderDetailEdit();
  const handleActiveRowChange = useMemo(
    () => (index: number | null) => {
      editContext?.setIsEditing(index != null);
    },
    [editContext],
  );
  const isReadOnly = usePoOrderReadOnly();

  const columns: SectionDetailColumn[] = [
    { label: "Articulo", width: "220px", mobileSpan: "full" },
    { label: "Descripcion", width: "150px", mobileSpan: "full" },
    { label: "Cantidad", width: "64px", className: "-ml-[15px]" },
    { label: "Precio", width: "84px", className: "ml-[0px]" },
    { label: "Importe", width: "84px", className: "ml-[30px]" },
    { label: "", width: "28px" },
  ];

  // Campos principales del detalle.
  const DetalleCamposPrincipales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => {
      const descripcionSource = useWrappedSource("descripcion");
      const descripcion = useWatch({ name: descripcionSource }) as string | undefined;
      const hasDescripcion = Boolean(descripcion?.trim());

      return (
        <>
          <DetailFieldCell
            label="Articulo"
            data-articulo-field="true"
            data-focus-field="true"
          >
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
          </DetailFieldCell>
          <DetailFieldCell
            label="Descripcion"
            className={cn(!hasDescripcion && "hidden sm:flex")}
          >
            <FormText
              source="descripcion"
              label={false}
              widthClass="w-full"
              readOnly={!isActive}
              className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Cant." className="gap-0">
            <FormNumber
              source="cantidad"
              label={false}
              inputMode="decimal"
              step="0.001"
              widthClass="w-full"
              validate={required()}
              readOnly={!isActive}
              className={cn(
                "gap-0 [&_input]:h-4.5 [&_input]:px-1 sm:[&_input]:h-5 sm:[&_input]:px-2",
                !isActive ? FORM_FIELD_READONLY_CLASS : undefined,
              )}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Precio" className="gap-0">
            <FormNumber
              source="precio"
              label={false}
              inputMode="decimal"
              step="0.01"
              widthClass="w-full"
              readOnly={!isActive}
              className={cn(
                "gap-0 [&_input]:h-4.5 [&_input]:px-1 sm:[&_input]:h-5 sm:[&_input]:px-2",
                !isActive ? FORM_FIELD_READONLY_CLASS : undefined,
              )}
            />
          </DetailFieldCell>
          <DetailFieldCell label="Importe" className="gap-0">
            <CalculatedImporte
              computeImporte={computeDetalleImporte}
              className="gap-0"
              widthClass="w-full"
              valueClassName={
                cn(
                  "px-1 sm:px-2",
                  !isActive ? FORM_VALUE_READONLY_CLASS : undefined,
                )
              }
            />
            <HiddenInput source="importe" />
          </DetailFieldCell>
        </>
      );
    },
    [articuloFilter],
  );

  // Campos opcionales del detalle.
  const DetalleCamposOpcionales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <div className="w-full">
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2 md:grid-cols-[210px_210px] md:justify-start">
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
      </div>
    ),
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Detalle"
      mainColumns={columns}
      mainFields={DetalleCamposPrincipales}
      optionalFields={DetalleCamposOpcionales}
      defaults={getPoOrderDetalleDefaults}
      maxHeightClassName="md:max-h-48"
      onActiveRowChange={handleActiveRowChange}
      readOnly={isReadOnly}
    />
  );
};

// Resumen de totales al pie del formulario.
const ResumenTotalesOrdenCompra = () => {
  const total = useWatch({ name: "total" }) as number | undefined;
  const totalValue = Number(total ?? 0);

  return (
    <div className="flex flex-row flex-nowrap items-center justify-start gap-2 rounded-md border border-muted/60 bg-muted/30 px-2 py-1 text-[8px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-3 sm:py-2 sm:text-[10px]">
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/90 px-2 py-0.5 text-[8px] font-semibold text-background whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-[10px]">
        Total:
        <NumberField
          source="total"
          record={{ total: totalValue }}
          options={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
          className="tabular-nums"
        />
      </span>
    </div>
  );
};

// === Seccion archivos ===

const ArchivosContent = ({
  record,
  pendingFile,
  nombre,
  uploading,
  deleting,
  onNombreChange,
  onUpload,
  onCancel,
  onDelete,
}: {
  record: PoOrderRecord;
  pendingFile: File | null;
  nombre: string;
  uploading: boolean;
  deleting: boolean;
  onNombreChange: (value: string) => void;
  onUpload: () => void;
  onCancel: () => void;
  onDelete: (archivoId: number) => void;
}) => {
  const archivos = record.archivos ?? [];

  return (
    <div className="flex flex-col gap-4">
      {pendingFile ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre del archivo</label>
            <Input
              value={nombre}
              onChange={(e) => onNombreChange(e.target.value)}
              placeholder="Nombre del archivo"
              className="h-8 text-sm"
              disabled={uploading}
            />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Archivo: {pendingFile.name}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={onUpload}
              disabled={uploading}
            >
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={onCancel}
              disabled={uploading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {archivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {archivos.map((a) => {
            let resolvedUrl = a.archivo_url ?? "";
            if (resolvedUrl.startsWith("gs://")) {
              resolvedUrl = resolvedUrl.replace(/^gs:\/\/([^/]+)\/(.+)$/, "https://storage.googleapis.com/$1/$2");
            } else if (resolvedUrl.startsWith("/")) {
              resolvedUrl = `${apiUrl}${resolvedUrl}`;
            }
            const displayNombre = a.nombre || resolvedUrl.split("/").pop() || "Archivo";
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-foreground">{displayNombre}</p>
                    {a.tipo ? (
                      <p className="text-[10px] text-muted-foreground">{a.tipo}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ArchivoViewerModal url={resolvedUrl} nombre={displayNombre} />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={deleting}
                    onClick={() => onDelete(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const ArchivosSection = ({ record }: { record: PoOrderRecord }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const { upload, loading: uploading } = usePoOrderArchivoUpload();
  const { deleteArchivo, loading: deleting } = usePoOrderArchivoDelete();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNombre(file.name);
    e.target.value = "";
  };

  const handleOpenPicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!pendingFile || !record.id) return;
    await upload(record.id as number, pendingFile, nombre.trim() || pendingFile.name);
    setPendingFile(null);
    setNombre("");
  };

  const handleCancel = () => {
    setPendingFile(null);
    setNombre("");
  };

  const handleDelete = (archivoId: number) => {
    if (!record.id) return;
    void deleteArchivo(record.id as number, archivoId);
  };

  return (
    <SectionBaseTemplate
      title="Archivos"
      actions={
        <DropdownMenuItem
          onSelect={handleOpenPicker}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          disabled={uploading}
        >
          <Upload className="h-3 w-3" />
          Subir archivo
        </DropdownMenuItem>
      }
      main={
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <ArchivosContent
            record={record}
            pendingFile={pendingFile}
            nombre={nombre}
            uploading={uploading}
            deleting={deleting}
            onNombreChange={setNombre}
            onUpload={handleUpload}
            onCancel={handleCancel}
            onDelete={handleDelete}
          />
        </>
      }
      defaultOpen={false}
    />
  );
};
