"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, FileText, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";

import { SimpleForm } from "@/components/simple-form";
import {
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormOrderToolbar,
  FormSectionPanel,
  FormSectionsDesktopLayout,
  FormSectionsMobileAccordion,
  type FormSectionsDesktopLayoutItem,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
  ArchivoViewerModal,
  resolveNumericId,
  useMinWidth,
  usePersistedActiveSection,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "../propiedades/dialog_styles";

import {
  CONTRATO_DEFAULT,
  MONEDA_OPCIONES,
  contratoSchema,
  type Contrato,
  type ContratoFormValues,
} from "./model";
import {
  calculateFechaRenovacionFromInicio,
  useCantidadMesesTipoActualizacion,
  useContratoArchivoDelete,
  useContratoArchivoUpload,
  useContratoArchivoUpdate,
  useDefaultLugarCelebracion,
  useDefaultTipoContratoId,
  useInquilinoDesdeContacto,
} from "./form_hooks";
import {
  ContratoAccionesDialogs,
  ContratoAccionesMenuItems,
  useContratoAccionesState,
} from "./contrato_acciones";

// ── Desktop layout ────────────────────────────────────────────────────────────

const DESKTOP_LAYOUT_BREAKPOINT = 1024;
const CONTRATO_ACTIVE_SECTION_STORAGE_KEY_PREFIX = "contratos-form-active-section";

type ContratoSectionId =
  | "vigencia"
  | "inquilino"
  | "garante"
  | "archivos";

type ContratoSectionVariant = "stacked" | "panel" | "accordion";

type ContratoSectionDefinition = FormSectionsDesktopLayoutItem<ContratoSectionId> & {
  render: (variant?: ContratoSectionVariant) => ReactNode;
};

const ContratoSectionActionsMenu = ({
  children,
  contentClassName = "w-32",
}: {
  children: ReactNode;
  contentClassName?: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground"
        tabIndex={-1}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={contentClassName}>
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

const renderContratoSectionVariant = ({
  variant,
  title,
  description,
  actions,
  wrapActionsMenu = true,
  persistKey,
  defaultOpen = true,
  readOnly = false,
  children,
}: {
  variant: ContratoSectionVariant;
  title: string;
  description?: string;
  actions?: ReactNode;
  wrapActionsMenu?: boolean;
  persistKey?: string;
  defaultOpen?: boolean;
  readOnly?: boolean;
  children: ReactNode;
}) => {
  const resolvedActions = actions
    ? wrapActionsMenu
      ? <ContratoSectionActionsMenu>{actions}</ContratoSectionActionsMenu>
      : actions
    : undefined;

  if (variant === "panel") {
    return (
      <FormSectionPanel title={title} description={description} actions={resolvedActions}>
        {children}
      </FormSectionPanel>
    );
  }

  if (variant === "accordion") {
    if (!resolvedActions) return children;

    return (
      <div className="space-y-2">
        <div className="flex justify-end">{resolvedActions}</div>
        {children}
      </div>
    );
  }

  return (
    <SectionBaseTemplate
      title={title}
      main={children}
      actions={resolvedActions}
      defaultOpen={defaultOpen}
      readOnly={readOnly}
      persistKey={persistKey}
    />
  );
};



// ── Desktop panel wrapper ─────────────────────────────────────────────────────


// ── Cabecera fields ─────────────────────────────────────────────────────────

const ContratoTipoContratoDefaultSync = () => {
  const record = useRecordContext<Contrato>();
  const defaultTipoContratoId = useDefaultTipoContratoId();
  const { setValue } = useFormContext<ContratoFormValues>();
  const tipoContratoValue = useWatch({ name: "tipo_contrato_id" }) as unknown;

  useEffect(() => {
    if (record?.id || !defaultTipoContratoId) return;
    const currentTipoContratoId = resolveNumericId(tipoContratoValue);
    if (currentTipoContratoId) return;
    setValue("tipo_contrato_id", defaultTipoContratoId, { shouldDirty: false });
  }, [defaultTipoContratoId, record?.id, setValue, tipoContratoValue]);

  return null;
};

const ContratoLugarCelebracionDefaultSync = () => {
  const record = useRecordContext<Contrato>();
  const defaultLugarCelebracion = useDefaultLugarCelebracion();
  const { setValue } = useFormContext<ContratoFormValues>();
  const lugarCelebracionValue = useWatch({ name: "lugar_celebracion" }) as
    | string
    | null
    | undefined;

  useEffect(() => {
    if (record?.id || !defaultLugarCelebracion) return;
    const currentLugar = String(lugarCelebracionValue ?? "").trim();
    if (currentLugar) return;
    setValue("lugar_celebracion", defaultLugarCelebracion, { shouldDirty: false });
  }, [defaultLugarCelebracion, lugarCelebracionValue, record?.id, setValue]);

  return null;
};

const ContratoFechaRenovacionSync = () => {
  const record = useRecordContext<Contrato>();
  const { control, setValue } = useFormContext<ContratoFormValues>();
  const { dirtyFields } = useFormState({ control });
  const fechaInicioValue = useWatch({ name: "fecha_inicio" }) as string | null | undefined;
  const tipoActualizacionValue = useWatch({ name: "tipo_actualizacion_id" }) as unknown;
  const fechaRenovacionValue = useWatch({ name: "fecha_renovacion" }) as string | null | undefined;
  const tipoActualizacionId = resolveNumericId(tipoActualizacionValue);
  const cantidadMeses = useCantidadMesesTipoActualizacion(tipoActualizacionId);

  useEffect(() => {
    if (readOnlyOrManualOverride(record?.id, dirtyFields?.fecha_renovacion)) return;

    const nextFechaRenovacion = calculateFechaRenovacionFromInicio(
      fechaInicioValue,
      cantidadMeses,
    );
    if (!nextFechaRenovacion) {
      if (!fechaRenovacionValue) return;
      setValue("fecha_renovacion", "", { shouldDirty: false });
      return;
    }
    if (String(fechaRenovacionValue ?? "") === nextFechaRenovacion) return;

    setValue("fecha_renovacion", nextFechaRenovacion, { shouldDirty: false });
  }, [
    cantidadMeses,
    dirtyFields?.fecha_renovacion,
    fechaInicioValue,
    fechaRenovacionValue,
    record?.id,
    setValue,
    tipoActualizacionId,
  ]);

  return null;
};

const readOnlyOrManualOverride = (
  recordId?: number,
  fechaRenovacionDirty?: unknown,
) => Boolean(recordId) || Boolean(fechaRenovacionDirty);

const PropiedadTipoFields = ({ readOnly = false }: { readOnly?: boolean }) => {
  const record = useRecordContext<Contrato>();
  const propiedadValue = useWatch({ name: "propiedad_id" }) as unknown;
  const propiedadId = resolveNumericId(propiedadValue) ?? resolveNumericId(record?.propiedad_id);
  const canEditPropiedad = !record?.id || record.estado === "borrador";
  const { data: propiedad } = useGetOne(
    "propiedades",
    { id: propiedadId ?? 0 },
    { enabled: Boolean(propiedadId) },
  );

  const propietarioNombre =
    (propiedad as { propietario?: string | null; propietario_ref?: { nombre?: string | null } | null } | undefined)
      ?.propietario_ref?.nombre ??
    (propiedad as { propietario?: string | null } | undefined)?.propietario ??
    record?.propiedad?.propietario_ref?.nombre ??
    record?.propiedad?.propietario ??
    "Sin asignar";

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
        <FormSelect
          optionText="nombre"
          label="Propiedad"
          widthClass="w-full md:w-[190px] xl:w-[220px]"
          emptyText="Sin asignar"
          validate={required("El campo Propiedad es obligatorio")}
          disabled={readOnly || !canEditPropiedad}
        />
      </ReferenceInput>
      <div className="flex flex-col gap-1">
        <FormValue
          label="Propietario"
          widthClass="w-full md:w-[180px] xl:w-[210px]"
          valueClassName="justify-start text-left"
        >
          {propietarioNombre}
        </FormValue>
      </div>
      <ReferenceInput source="tipo_contrato_id" reference="tipos-contrato" label="Tipo de contrato">
        <FormSelect
          optionText="nombre"
          label="Tipo de contrato"
          widthClass="w-full md:w-[150px] xl:w-[175px]"
          emptyText="Sin asignar"
          validate={required("El campo Tipo de contrato es obligatorio")}
          disabled={readOnly}
        />
      </ReferenceInput>
    </div>
  );
};

// ── Section: Vigencia y economía ─────────────────────────────────────────────

const VigenciaEconomiaFields = ({ readOnly = false }: { readOnly?: boolean }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <div className="mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Vigencia
          </h3>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
          <FormDate source="fecha_inicio" label="Inicio" widthClass="w-full md:w-[118px] xl:w-[132px]" validate={required("El campo Inicio es obligatorio")} readOnly={readOnly} />
          <FormDate source="fecha_vencimiento" label="Finalizacion" widthClass="w-full md:w-[128px] xl:w-[144px]" validate={required("El campo Finalizacion es obligatorio")} readOnly={readOnly} />
          <FormText
            source="lugar_celebracion"
            label="Lugar"
            widthClass="w-full md:w-[180px] xl:w-[220px]"
            maxLength={200}
            readOnly={readOnly}
          />
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <div className="mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Condiciones economicas
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <FormNumber source="valor_alquiler" label="Valor alquiler" step="any" min={0} widthClass="w-full md:w-[118px] xl:w-[132px]" validate={required("El campo Valor alquiler es obligatorio")} readOnly={readOnly} />
          <FormSelect
            source="moneda"
            label="Moneda"
            widthClass="w-full md:w-[96px] xl:w-[108px]"
            choices={MONEDA_OPCIONES}
            optionText="nombre"
            optionValue="id"
            disabled={readOnly}
          />
          <ReferenceInput source="tipo_actualizacion_id" reference="tipos-actualizacion" label="Tipo de actualizacion">
            <FormSelect optionText="nombre" label="Tipo de actualizacion" widthClass="w-full md:w-[128px] xl:w-[144px]" emptyText="Sin asignar" disabled={readOnly} />
          </ReferenceInput>
          <FormDate source="fecha_renovacion" label="Proxima actualizacion" widthClass="w-full md:w-[122px] xl:w-[136px]" readOnly={readOnly} />
          <FormNumber source="expensas" label="Expensas" step="any" min={0} widthClass="w-full md:w-[110px] xl:w-[122px]" readOnly={readOnly} />
          <FormNumber source="deposito_garantia" label="Deposito garantia" step="any" min={0} widthClass="w-full md:w-[136px] xl:w-[154px]" readOnly={readOnly} />
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <div className="mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Observaciones
          </h3>
        </div>
        <FormTextarea
          source="observaciones"
          label="Observaciones"
          widthClass="w-full"
          className="[&_textarea]:min-h-[96px]"
          maxLength={2000}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

// ── Section: Persona (inquilino / garante) ───────────────────────────────────

const PersonaFields = ({ prefix, readOnly = false }: { prefix: string; readOnly?: boolean }) => {
  const isInquilino = prefix === "inquilino";

  return (
  <div className="grid gap-2 md:grid-cols-3">
    <FormText
      source={`${prefix}_apellido`}
      label="Apellido"
      widthClass="w-full"
      maxLength={120}
      validate={isInquilino ? required("El campo Apellido es obligatorio") : undefined}
      readOnly={readOnly}
    />
    <FormText
      source={`${prefix}_nombre`}
      label="Nombre"
      widthClass="w-full"
      maxLength={120}
      validate={isInquilino ? required("El campo Nombre es obligatorio") : undefined}
      readOnly={readOnly}
    />
    <FormText source={`${prefix}_dni`} label="DNI" widthClass="w-full" maxLength={20} readOnly={readOnly} />
    <FormText source={`${prefix}_cuit`} label="CUIT" widthClass="w-full" maxLength={20} readOnly={readOnly} />
    <FormText source={`${prefix}_email`} label="Email" widthClass="w-full" maxLength={200} readOnly={readOnly} />
    <FormText source={`${prefix}_telefono`} label="Telefono" widthClass="w-full" maxLength={50} readOnly={readOnly} />
    <FormText
      source={`${prefix}_domicilio`}
      label="Domicilio"
      widthClass="w-full md:col-span-3"
      maxLength={300}
      readOnly={readOnly}
    />
  </div>
  );
};

const GaranteGroup = ({
  title,
  prefix,
  readOnly = false,
}: {
  title: string;
  prefix: "garante1" | "garante2";
  readOnly?: boolean;
}) => (
  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <PersonaFields prefix={prefix} readOnly={readOnly} />
  </div>
);

const GaranteFields = ({ readOnly = false }: { readOnly?: boolean }) => (
  <div className="grid gap-3">
    <GaranteGroup title="Garante 1" prefix="garante1" readOnly={readOnly} />
    <GaranteGroup title="Garante 2" prefix="garante2" readOnly={readOnly} />
  </div>
);

const InquilinoHeaderActions = ({ readOnly = false }: { readOnly?: boolean }) => {
  const record = useRecordContext<Contrato>();
  const propiedadValue = useWatch({ name: "propiedad_id" }) as unknown;
  const propiedadId = resolveNumericId(propiedadValue) ?? resolveNumericId(record?.propiedad_id);
  const { canCompletar, completar, contactoNombre, isLoading } =
    useInquilinoDesdeContacto(propiedadId);

  return (
    <div className="flex items-center justify-end gap-0">
      <span className="text-[11px] font-medium text-muted-foreground">Contacto</span>
      <div className="flex h-6 min-w-0 items-center rounded-md border border-border/60 bg-muted/15 px-1 text-sm text-foreground md:w-[132px]">
        <span className="truncate">{contactoNombre}</span>
      </div>
      {!readOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground"
          onClick={completar}
          disabled={!canCompletar || isLoading}
          title="Completar inquilino desde contacto"
          aria-label="Completar inquilino desde contacto"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
};

// ── Archivos inline content ───────────────────────────────────────────────────

const ContratoArchivoDescripcionPopover = ({
  archivo,
  contratoId,
  disabled = false,
}: {
  archivo: NonNullable<Contrato["archivos"]>[number];
  contratoId: number;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const { updateArchivo, loading } = useContratoArchivoUpdate();

  useEffect(() => {
    if (!open) return;
    setValue(String(archivo.descripcion ?? ""));
  }, [archivo.descripcion, open]);

  const handleSave = async () => {
    if (disabled || loading) return;
    const ok = await updateArchivo(contratoId, archivo.id, {
      descripcion: value.trim() || null,
    });
    if (ok) {
      setOpen(false);
    }
  };

  return (
    <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex w-full min-w-0 items-start gap-2 rounded-md px-1 py-1 text-left transition hover:bg-muted/30"
            onClick={(event) => {
              event.stopPropagation();
              if (!disabled) setOpen(true);
            }}
            data-row-click="ignore"
            aria-label="Editar descripcion del archivo"
            title="Editar descripcion del archivo"
            disabled={disabled}
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-medium text-foreground">{archivo.nombre || "Archivo"}</p>
              {archivo.descripcion ? (
                <p className="text-[10px] text-muted-foreground">{archivo.descripcion}</p>
              ) : archivo.tipo ? (
                <p className="text-[10px] text-muted-foreground">{archivo.tipo}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Sin descripcion</p>
              )}
            </div>
            {!disabled ? (
              <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700/70 opacity-0 transition group-hover:opacity-100" />
            ) : null}
          </button>
        </PopoverTrigger>
        {!disabled ? (
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-80 border-none bg-transparent p-0 shadow-none"
          >
            <SectionBaseTemplate
              title="Editar descripcion"
              main={
                <div className="space-y-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="break-all text-xs font-medium text-foreground">{archivo.nombre || "Archivo"}</p>
                  </div>
                  <Textarea
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="min-h-[88px] text-sm"
                    placeholder="Escribe una descripcion..."
                    disabled={loading}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={loading}
                      onClick={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={loading}
                      onClick={() => void handleSave()}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              }
            />
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
};

const ArchivosContent = ({
  contrato,
  deleting,
  readOnly = false,
  onDelete,
}: {
  contrato: Contrato;
  deleting: boolean;
  readOnly?: boolean;
  onDelete: (archivo: NonNullable<Contrato["archivos"]>[number]) => void;
}) => {
  const archivos = contrato.archivos ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* File list */}
      {archivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {archivos.map((a) => {
            // Resolve URL to something the browser can open
            let resolvedUrl = a.archivo_url ?? "";
            if (resolvedUrl.startsWith("gs://")) {
              // gs://bucket/path → https://storage.googleapis.com/bucket/path
              resolvedUrl = resolvedUrl.replace(/^gs:\/\/([^/]+)\/(.+)$/, "https://storage.googleapis.com/$1/$2");
            } else if (resolvedUrl.startsWith("/")) {
              resolvedUrl = `${apiUrl}${resolvedUrl}`;
            }
            // Fallback name: extract last segment from URL
            const displayNombre = a.nombre || resolvedUrl.split("/").pop() || "Archivo";
            return (
              <li key={a.id} className="flex items-start justify-between gap-2 py-1.5">
                <ContratoArchivoDescripcionPopover
                  archivo={{ ...a, nombre: displayNombre }}
                  contratoId={contrato.id}
                  disabled={readOnly}
                />
                <div className="mt-1 flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-1 py-0.5">
                  <ArchivoViewerModal url={resolvedUrl} nombre={displayNombre} />
                  {!readOnly ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      disabled={deleting}
                      onClick={() => onDelete({ ...a, nombre: displayNombre })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ── Section wrapper components ────────────────────────────────────────────────

const VigenciaSection = ({
  variant = "stacked",
  readOnly = false,
}: {
  variant?: ContratoSectionVariant;
  readOnly?: boolean;
}) =>
  renderContratoSectionVariant({
    variant,
    title: "Terminos y economia",
    description: "Fechas del contrato y condiciones economicas.",
    persistKey: "contratos-vigencia",
    readOnly,
    children: <VigenciaEconomiaFields readOnly={readOnly} />,
  });

const InquilinoSection = ({
  variant = "stacked",
  readOnly = false,
}: {
  variant?: ContratoSectionVariant;
  readOnly?: boolean;
}) =>
  renderContratoSectionVariant({
    variant,
    title: "Inquilino",
    description: "Datos del inquilino principal.",
    actions: <InquilinoHeaderActions readOnly={readOnly} />,
    wrapActionsMenu: false,
    persistKey: "contratos-inquilino",
    readOnly,
    children: <PersonaFields prefix="inquilino" readOnly={readOnly} />,
  });

const GaranteSection = ({
  variant = "stacked",
  readOnly = false,
}: {
  variant?: ContratoSectionVariant;
  readOnly?: boolean;
}) =>
  renderContratoSectionVariant({
    variant,
    title: "Garante",
    description: "Datos de los garantes asociados al contrato.",
    persistKey: "contratos-garante",
    readOnly,
    children: <GaranteFields readOnly={readOnly} />,
  });

const ArchivosSection = ({
  variant = "stacked",
  contrato,
  readOnly = false,
}: {
  variant?: ContratoSectionVariant;
  contrato: Contrato;
  readOnly?: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [archivoAEliminar, setArchivoAEliminar] = useState<NonNullable<Contrato["archivos"]>[number] | null>(null);
  const { upload, loading: uploading } = useContratoArchivoUpload();
  const { deleteArchivo, loading: deleting } = useContratoArchivoDelete();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNombre(file.name);
    setDescripcion("");
    setConfirmUploadOpen(true);
    e.target.value = "";
  };

  const handleOpenPicker = () => {
    if (readOnly || uploading) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    await upload(contrato.id, pendingFile, nombre.trim() || pendingFile.name, undefined, descripcion.trim() || undefined);
    setConfirmUploadOpen(false);
    setPendingFile(null);
    setNombre("");
    setDescripcion("");
  };

  const handleCancel = () => {
    setConfirmUploadOpen(false);
    setPendingFile(null);
    setNombre("");
    setDescripcion("");
  };

  const handleDeleteRequest = (archivo: NonNullable<Contrato["archivos"]>[number]) => {
    setArchivoAEliminar(archivo);
  };

  const handleDeleteConfirm = async () => {
    if (!archivoAEliminar) return;
    const ok = await deleteArchivo(contrato.id, archivoAEliminar.id);
    if (ok) {
      setArchivoAEliminar(null);
    }
  };

  const archivoActions = readOnly
    ? undefined
    : (
        <DropdownMenuItem
          onSelect={handleOpenPicker}
          className="gap-1 px-1.5 py-1 text-[8px] sm:text-[10px]"
          disabled={uploading}
        >
          <Upload className="h-3 w-3" />
          Subir archivo
        </DropdownMenuItem>
      );

  const archivosMain = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
        onChange={handleFileSelect}
        disabled={readOnly || uploading}
      />
      <ArchivosContent
        contrato={contrato}
        deleting={deleting}
        readOnly={readOnly}
        onDelete={handleDeleteRequest}
      />
      <Dialog
        open={confirmUploadOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}>
          <DialogHeader>
            <DialogTitle>Subir archivo</DialogTitle>
            <DialogDescription>
              Se adjuntará el archivo al contrato y quedará disponible en esta sección.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre del archivo</label>
              <Input
                value={nombre}
                readOnly
                placeholder="Nombre del archivo"
                className="h-9 text-sm"
                disabled
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground">Descripcion <span className="font-normal">(opcional)</span></label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: DNI del inquilino, contrato firmado..."
                className="h-9 text-sm"
                disabled={uploading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(archivoAEliminar)}
        onOpenChange={(open) => {
          if (!open) setArchivoAEliminar(null);
        }}
      >
        <DialogContent overlayClassName={PROPIEDAD_DIALOG_OVERLAY_CLASS}>
          <DialogHeader>
            <DialogTitle>Eliminar archivo</DialogTitle>
            <DialogDescription>
              Se eliminará el archivo adjunto del contrato. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <div className="grid gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Archivo
              </span>
              <span className="break-all text-sm text-foreground">
                {archivoAEliminar?.nombre ?? "Sin archivo"}
              </span>
              {archivoAEliminar?.descripcion ? (
                <span className="text-xs text-muted-foreground">{archivoAEliminar.descripcion}</span>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchivoAEliminar(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return renderContratoSectionVariant({
    variant,
    title: "Archivos",
    description: "Documentos adjuntos al contrato.",
    actions: archivoActions,
    persistKey: `contratos-archivos-${contrato.id}`,
    readOnly,
    children: archivosMain,
  });
};

// ── Desktop sections layout ───────────────────────────────────────────────────

const ContratoDesktopSectionsLayout = ({
  activeSection,
  availableSections,
  onSectionChange,
}: {
  activeSection: ContratoSectionId;
  availableSections: ContratoSectionDefinition[];
  onSectionChange: (id: ContratoSectionId) => void;
}) => {
  const activeSectionDefinition =
    availableSections.find((section) => section.id === activeSection) ?? availableSections[0];

  return (
    <FormSectionsDesktopLayout
      sections={availableSections}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    >
      {activeSectionDefinition?.render("panel") ?? null}
    </FormSectionsDesktopLayout>
  );
};

// ── Sections content orchestrator ─────────────────────────────────────────────

const getContratoSectionDefinitions = ({
  contrato,
  readOnly = false,
}: {
  contrato: Contrato | null;
  readOnly?: boolean;
}): ContratoSectionDefinition[] => {
  const sections: ContratoSectionDefinition[] = [
    {
      id: "vigencia",
      label: "Terminos",
      render: (variant = "stacked") => (
        <VigenciaSection variant={variant} readOnly={readOnly} />
      ),
    },
    {
      id: "inquilino",
      label: "Inquilino",
      render: (variant = "stacked") => (
        <InquilinoSection variant={variant} readOnly={readOnly} />
      ),
    },
    {
      id: "garante",
      label: "Garante",
      render: (variant = "stacked") => (
        <GaranteSection variant={variant} readOnly={readOnly} />
      ),
    },
  ];

  if (contrato?.id) {
    sections.push({
      id: "archivos",
      label: "Archivos",
      render: (variant = "stacked") => (
        <ArchivosSection variant={variant} contrato={contrato} readOnly={readOnly} />
      ),
    });
  }

  return sections;
};

const ContratoFormSectionsContent = ({
  contrato,
  readOnly = false,
}: {
  contrato: Contrato | null;
  readOnly?: boolean;
}) => {
  const location = useLocation();
  const isDesktop = useMinWidth(DESKTOP_LAYOUT_BREAKPOINT);
  const availableSections = useMemo(
    () => getContratoSectionDefinitions({ contrato, readOnly }),
    [contrato, readOnly],
  );
  const activeSectionStorageKey = `${CONTRATO_ACTIVE_SECTION_STORAGE_KEY_PREFIX}:${location.pathname}`;
  const [activeSection, setActiveSection] = usePersistedActiveSection<ContratoSectionId>({
    storageKey: activeSectionStorageKey,
    sections: availableSections.map((section) => section.id),
    defaultSection: availableSections[0]?.id ?? "vigencia",
  });

  if (isDesktop) {
    return (
      <ContratoDesktopSectionsLayout
        activeSection={activeSection}
        availableSections={availableSections}
        onSectionChange={setActiveSection}
      />
    );
  }

  return (
    <FormSectionsMobileAccordion<ContratoSectionId, ContratoSectionDefinition>
      sections={availableSections}
      defaultOpenSectionIds={[availableSections[0]?.id ?? "vigencia"]}
      renderSection={(section) => section.render("accordion")}
    />
  );
};

// ── Sticky footer ─────────────────────────────────────────────────────────────

const ContratoStickyFooter = () => (
  <div className="sticky -bottom-6 z-20 mt-2 border-t border-border/60 bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85">
    <div className="flex justify-end">
      <FormOrderToolbar
        className="shrink-0 justify-end flex-nowrap"
        saveProps={{ variant: "secondary" }}
      />
    </div>
  </div>
);

// ── Main form ─────────────────────────────────────────────────────────────────

export const ContratoForm = ({ readOnly = false }: { readOnly?: boolean }) => {
  const record = useRecordContext<Contrato>();
  const location = useLocation();
  const acciones = useContratoAccionesState(record);
  const defaultPropiedadId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveNumericId(params.get("propiedad_id"));
  }, [location.search]);
  const defaultValues = useMemo(
    () => ({
      ...CONTRATO_DEFAULT,
      ...(!record?.id && defaultPropiedadId ? { propiedad_id: defaultPropiedadId } : {}),
    }),
    [defaultPropiedadId, record?.id],
  );

  return (
    <SimpleForm<ContratoFormValues>
      className="w-full max-w-5xl max-h-[calc(100svh-10rem)] overflow-y-auto overscroll-y-contain pr-1 pb-4 sm:max-h-[calc(100svh-9rem)]"
      resolver={zodResolver(contratoSchema) as any}
      toolbar={readOnly ? false : <ContratoStickyFooter />}
      defaultValues={defaultValues}
      warnWhenUnsavedChanges={!readOnly}
    >
      <ContratoTipoContratoDefaultSync />
      <ContratoLugarCelebracionDefaultSync />
      <ContratoFechaRenovacionSync />
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Cabecera"
        main={<PropiedadTipoFields readOnly={readOnly} />}
        defaultOpen
        readOnly={readOnly}
        actions={!readOnly && record?.id ? <ContratoAccionesMenuItems acciones={acciones} /> : undefined}
      />
      <ContratoFormSectionsContent contrato={record ?? null} readOnly={readOnly} />
      {!readOnly && record?.id ? <ContratoAccionesDialogs acciones={acciones} /> : null}
    </SimpleForm>
  );
};
