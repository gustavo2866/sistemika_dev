"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { required, useGetOne, useRecordContext } from "ra-core";
import { useLocation } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, MoreHorizontal, Trash2, Upload } from "lucide-react";

import { SimpleForm } from "@/components/simple-form";
import {
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormOrderToolbar,
  FormSelect,
  FormText,
  FormTextarea,
  FormValue,
  SectionBaseTemplate,
  ArchivoViewerModal,
  resolveNumericId,
} from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/dataProvider";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { PROPIEDAD_DIALOG_OVERLAY_CLASS } from "../propiedades/dialog_styles";

import {
  CONTRATO_DEFAULT,
  MONEDA_OPCIONES,
  contratoSchema,
  type Contrato,
  type ContratoFormValues,
} from "./model";import {
  useContratoArchivoDelete,
  useContratoArchivoUpload,
} from "./form_hooks";
import {
  ContratoAccionesDialogs,
  ContratoAccionesMenuItems,
  useContratoAccionesState,
} from "./contrato_acciones";

// ── Desktop layout ────────────────────────────────────────────────────────────

const DESKTOP_LAYOUT_BREAKPOINT = 1024;

type ContratoSectionId =
  | "vigencia"
  | "inquilino"
  | "garante"
  | "archivos";

type ContratoSectionVariant = "stacked" | "panel";

const CONTRATO_SECTIONS: Array<{ id: ContratoSectionId; label: string }> = [
  { id: "vigencia", label: "Terminos" },
  { id: "inquilino", label: "Inquilino" },
  { id: "garante", label: "Garante" },
  { id: "archivos", label: "Archivos" },
];

const useContratoDesktopLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_LAYOUT_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_LAYOUT_BREAKPOINT}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
};

// ── Desktop panel wrapper ─────────────────────────────────────────────────────

const ContratoDesktopPanel = ({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex min-h-[24rem] flex-col">
    {title || description ? (
      <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3 xl:px-5">
        <div className="min-w-0">
          {title ? (
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
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
            <DropdownMenuContent align="end" className="w-32">
              {actions}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    ) : null}
    <div className="min-w-0 overflow-x-auto px-4 py-4 xl:px-6 xl:py-5">{children}</div>
  </section>
);

// ── Cabecera fields ─────────────────────────────────────────────────────────

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
          disabled={readOnly || !canEditPropiedad}
        />
      </ReferenceInput>
      <div className="flex flex-col gap-1">
        <FormValue label="Propietario" widthClass="w-full md:w-[180px] xl:w-[210px]">
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
            Condiciones economicas
          </h3>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
          <FormNumber source="valor_alquiler" label="Valor alquiler" step="any" min={0} widthClass="w-full md:w-[118px] xl:w-[132px]" readOnly={readOnly} />
          <FormNumber source="expensas" label="Expensas" step="any" min={0} widthClass="w-full md:w-[110px] xl:w-[122px]" readOnly={readOnly} />
          <FormNumber source="deposito_garantia" label="Deposito garantia" step="any" min={0} widthClass="w-full md:w-[136px] xl:w-[154px]" readOnly={readOnly} />
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
            <FormSelect optionText="nombre" label="Tipo de actualizacion" widthClass="w-full md:w-[150px] xl:w-[170px]" emptyText="Sin asignar" disabled={readOnly} />
          </ReferenceInput>
          <FormDate source="fecha_renovacion" label="Fecha de proxima actualizacion" widthClass="w-full md:w-[170px] xl:w-[184px]" readOnly={readOnly} />
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <div className="mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Vigencia
          </h3>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <FormDate source="fecha_inicio" label="Fecha de inicio" widthClass="w-full" readOnly={readOnly} />
          <FormDate source="fecha_vencimiento" label="Fecha de finalizacion" widthClass="w-full" readOnly={readOnly} />
          <FormText
            source="lugar_celebracion"
            label="Lugar de celebracion"
            widthClass="w-full md:col-span-3"
            maxLength={200}
            readOnly={readOnly}
          />
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
      source={`${prefix}_nombre`}
      label="Nombre"
      widthClass="w-full"
      maxLength={120}
      validate={isInquilino ? required("El campo Nombre es obligatorio") : undefined}
      readOnly={readOnly}
    />
    <FormText
      source={`${prefix}_apellido`}
      label="Apellido"
      widthClass="w-full"
      maxLength={120}
      validate={isInquilino ? required("El campo Apellido es obligatorio") : undefined}
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

// ── Archivos inline content ───────────────────────────────────────────────────

const ArchivosContent = ({
  contrato,
  deleting,
  readOnly = false,
  onDelete,
}: {
  contrato: Contrato;
  deleting: boolean;
  readOnly?: boolean;
  onDelete: (archivoId: number) => void;
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
                {!readOnly ? (
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

const VigenciaSection = ({ variant = "stacked", readOnly = false }: { variant?: ContratoSectionVariant; readOnly?: boolean }) => {
  if (variant === "panel") {
    return (
      <ContratoDesktopPanel title="Terminos y economia" description="Fechas del contrato y condiciones economicas.">
        <VigenciaEconomiaFields readOnly={readOnly} />
      </ContratoDesktopPanel>
    );
  }
  return <SectionBaseTemplate title="Terminos y economia" main={<VigenciaEconomiaFields readOnly={readOnly} />} defaultOpen readOnly={readOnly} />;
};

const InquilinoSection = ({ variant = "stacked", readOnly = false }: { variant?: ContratoSectionVariant; readOnly?: boolean }) => {
  if (variant === "panel") {
    return (
      <ContratoDesktopPanel title="Inquilino" description="Datos del inquilino principal.">
        <PersonaFields prefix="inquilino" readOnly={readOnly} />
      </ContratoDesktopPanel>
    );
  }
  return <SectionBaseTemplate title="Inquilino" main={<PersonaFields prefix="inquilino" readOnly={readOnly} />} defaultOpen readOnly={readOnly} />;
};

const GaranteSection = ({ variant = "stacked", readOnly = false }: { variant?: ContratoSectionVariant; readOnly?: boolean }) => {
  if (variant === "panel") {
    return (
      <ContratoDesktopPanel title="Garante" description="Datos de los garantes asociados al contrato.">
        <GaranteFields readOnly={readOnly} />
      </ContratoDesktopPanel>
    );
  }
  return <SectionBaseTemplate title="Garante" main={<GaranteFields readOnly={readOnly} />} readOnly={readOnly} />;
};

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
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const { upload, loading: uploading } = useContratoArchivoUpload();
  const { deleteArchivo, loading: deleting } = useContratoArchivoDelete();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNombre(file.name);
    setConfirmUploadOpen(true);
    e.target.value = "";
  };

  const handleOpenPicker = () => {
    if (readOnly || uploading) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    await upload(contrato.id, pendingFile, nombre.trim() || pendingFile.name);
    setConfirmUploadOpen(false);
    setPendingFile(null);
    setNombre("");
  };

  const handleCancel = () => {
    setConfirmUploadOpen(false);
    setPendingFile(null);
    setNombre("");
  };

  const handleDelete = (archivoId: number) => {
    void deleteArchivo(contrato.id, archivoId);
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
        onDelete={handleDelete}
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
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del archivo"
                className="h-9 text-sm"
                disabled={uploading}
              />
            </div>
            <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <div className="grid gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Nombre
              </span>
              <span className="break-all text-foreground">
                {nombre.trim() || pendingFile?.name || "Sin nombre"}
              </span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Archivo
              </span>
              <span className="break-all text-foreground">
                {pendingFile?.name ?? "Sin archivo"}
              </span>
            </div>
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
    </>
  );

  if (variant === "panel") {
    return (
      <ContratoDesktopPanel
        title="Archivos"
        description="Documentos adjuntos al contrato."
        actions={archivoActions}
      >
        {archivosMain}
      </ContratoDesktopPanel>
    );
  }
  return (
    <SectionBaseTemplate title="Archivos" main={archivosMain} actions={archivoActions} readOnly={readOnly} />
  );
};

// ── Desktop sections layout ───────────────────────────────────────────────────

const ContratoDesktopSectionsLayout = ({
  activeSection,
  visibleSections,
  onSectionChange,
  contrato,
  readOnly = false,
}: {
  activeSection: ContratoSectionId;
  visibleSections: Array<{ id: ContratoSectionId; label: string }>;
  onSectionChange: (id: ContratoSectionId) => void;
  contrato: Contrato | null;
  readOnly?: boolean;
}) => {
  const activeConfig = visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0];

  const renderSection = () => {
    switch (activeSection) {
      case "vigencia":
        return <VigenciaSection variant="panel" readOnly={readOnly} />;
      case "inquilino":
        return <InquilinoSection variant="panel" readOnly={readOnly} />;
      case "garante":
        return <GaranteSection variant="panel" readOnly={readOnly} />;
      case "archivos":
        return contrato ? <ArchivosSection variant="panel" contrato={contrato} readOnly={readOnly} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="hidden rounded-[28px] border border-border/60 bg-card/90 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] lg:grid lg:grid-cols-[98px_minmax(0,1fr)]">
      <aside className="border-r border-border/50 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.96)_100%)] p-2">
        <div className="flex flex-col gap-1">
          {visibleSections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "group mr-[-10px] flex min-h-[34px] items-center justify-center rounded-l-lg rounded-r-none border border-r-0 px-2 py-1 text-center transition-all",
                  isActive
                    ? "-translate-x-2 border-border/80 bg-background text-foreground shadow-[10px_12px_30px_-24px_rgba(15,23,42,0.45)]"
                    : "border-transparent bg-muted/50 text-slate-500 hover:bg-muted/80 hover:text-slate-700",
                )}
                aria-pressed={isActive}
              >
                <span className="whitespace-normal break-words text-[10px] font-semibold leading-[1.05]">
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 overflow-x-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(249,250,251,0.96)_100%)]">
        {activeConfig ? <div className="sr-only">{activeConfig.label}</div> : null}
        {renderSection()}
      </div>
    </div>
  );
};

// ── Sections content orchestrator ─────────────────────────────────────────────

const ContratoFormSectionsContent = ({
  contrato,
  readOnly = false,
}: {
  contrato: Contrato | null;
  readOnly?: boolean;
}) => {
  const isDesktop = useContratoDesktopLayout();
  const isEdit = Boolean(contrato?.id);

  const visibleSections = useMemo(
    () => CONTRATO_SECTIONS.filter((s) => (s.id === "archivos" ? isEdit : true)),
    [isEdit],
  );

  const [activeSection, setActiveSection] = useState<ContratoSectionId>("vigencia");

  useEffect(() => {
    if (visibleSections.some((s) => s.id === activeSection)) return;
    setActiveSection(visibleSections[0]?.id ?? "vigencia");
  }, [activeSection, visibleSections]);

  if (isDesktop) {
    return (
      <ContratoDesktopSectionsLayout
        activeSection={activeSection}
        visibleSections={visibleSections}
        onSectionChange={setActiveSection}
        contrato={contrato}
        readOnly={readOnly}
      />
    );
  }

  return (
    <>
      <VigenciaSection readOnly={readOnly} />
      <InquilinoSection readOnly={readOnly} />
      <GaranteSection readOnly={readOnly} />
      {isEdit && contrato ? <ArchivosSection contrato={contrato} readOnly={readOnly} /> : null}
    </>
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


