"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useGetOne, useNotify, useRecordContext, useRefresh } from "ra-core";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { FormOrderToolbar } from "@/components/forms";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
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
import { NominaQuickCreateDialog } from "./nomina-quick-create-dialog";
import {
  ArchivoViewerModal,
  FormBoolean,
  FormDate,
  FormNumber,
  FormReferenceAutocomplete,
  FormTextarea,
  FormValue,
  HiddenInput,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  TARJA_NOMINA_DEFAULT,
  VALIDATION_RULES,
  tarjaNominaSchema,
  type TarjaNominaFormValues,
} from "./model";

const LockedReferenceValue = ({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) => (
  <div className="rounded-md border bg-muted/30 px-2 py-1">
    <div className="text-[9px] font-semibold leading-none text-muted-foreground sm:text-[10px]">
      {label}
    </div>
    <div className="mt-0.5 text-[10px] font-medium leading-tight text-foreground">
      {primary}
    </div>
    {secondary ? (
      <div className="text-[9px] leading-tight text-muted-foreground">
        {secondary}
      </div>
    ) : null}
  </div>
);

const toAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const toOptionalId = (value: unknown) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

const formatMoney = (value: number) =>
  value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatHoursValue = (value: number) =>
  value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateValue = (value?: string | null) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "-";
};

const buildAuthHeaders = () => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("auth_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

type TarjaNominaDocumento = {
  url: string;
  nombre: string;
  content_type?: string | null;
  size?: number | null;
};

const parseDocumento = (value: unknown): TarjaNominaDocumento | null => {
  if (!value) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const url = String(record.url ?? record.archivo_url ?? "").trim();
    if (!url) return null;
    return {
      url,
      nombre: String(record.nombre ?? "").trim() || url.split("/").pop() || "Documento",
      content_type: record.content_type ? String(record.content_type) : null,
      size: Number.isFinite(Number(record.size)) ? Number(record.size) : null,
    };
  }
  const text = String(value).trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      return parseDocumento(JSON.parse(text));
    } catch {
      // Fallback to treating it as a plain URL.
    }
  }
  return {
    url: text,
    nombre: text.split("/").pop() || "Documento",
  };
};

const getDocumentoUrl = (url: string) => {
  if (url.startsWith("gs://")) {
    return url.replace(/^gs:\/\/([^/]+)\/(.+)$/, "https://storage.googleapis.com/$1/$2");
  }
  return url.startsWith("/") ? `${apiUrl}${url}` : url;
};

const useTarjaNominaDocumentoUpload = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const upload = async (registroId: number, file: File, nombre?: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (nombre) formData.append("nombre", nombre);
      const response = await fetch(`${apiUrl}/tarja-nomina/${registroId}/documentos`, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload?.detail ?? "No se pudo subir el documento", { type: "warning" });
        return false;
      }
      notify("Documento subido", { type: "info" });
      refresh();
      return true;
    } catch {
      notify("Error al subir el documento", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading };
};

const useTarjaNominaDocumentoDelete = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const deleteDocumento = async (registroId: number, url: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/tarja-nomina/${registroId}/documentos`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload?.detail ?? "No se pudo eliminar el documento", { type: "warning" });
        return false;
      }
      notify("Documento eliminado", { type: "info" });
      refresh();
      return true;
    } catch {
      notify("Error al eliminar el documento", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteDocumento, loading };
};

const getEmpleadoLabel = (choice?: unknown) => {
  if (!choice || typeof choice !== "object") return "";
  const record = choice as {
    apellido?: string | null;
    nombre?: string | null;
    dni?: string | null;
  };
  const nombre = [record.apellido, record.nombre].filter(Boolean).join(", ");
  return [nombre, record.dni].filter(Boolean).join(" - ");
};

const ReadOnlyNumber = ({
  label,
  value,
  strong = false,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) => (
  <FormValue
    label={label}
    widthClass="w-full"
    className={className}
    valueClassName={`justify-end bg-muted/30 tabular-nums text-muted-foreground ${strong ? "font-semibold text-foreground" : ""}`}
  >
    {value}
  </FormValue>
);

type EmpleadoReference = {
  id: number | string;
  apellido?: string | null;
  nombre?: string | null;
  nombre_completo?: string | null;
  dni?: string | null;
  nomina_categoria_id?: number | null;
  nomina_tarea_id?: number | null;
  idproyecto?: number | null;
  encargado_contacto_id?: number | null;
};

const TarjaNominaHeaderFields = ({
  lockTarja = false,
  lockEmpleado = false,
  defaultValues,
  empleadoLabel,
  obraLabel,
  encargadoId,
  encargadoLabel,
  isCreate = false,
}: {
  lockTarja?: boolean;
  lockEmpleado?: boolean;
  defaultValues?: Partial<TarjaNominaFormValues>;
  empleadoLabel?: string;
  obraLabel?: string;
  encargadoId?: number;
  encargadoLabel?: string;
  isCreate?: boolean;
}) => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const fechaIngreso = useWatch({ name: "fecha_desde" });
  const fechaEgreso = useWatch({ name: "fecha_hasta" });
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const handleEmpleadoCreated = (record: EmpleadoReference) => {
    setValue("nomina_id", Number(record.id), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("nomina_categoria_id", record.nomina_categoria_id ?? undefined, {
      shouldDirty: true,
    });
    setValue("nomina_tarea_id", record.nomina_tarea_id ?? undefined, {
      shouldDirty: true,
    });
    setQuickCreateOpen(false);
  };

  const empleadoFieldLabel = (
    <span className="inline-flex items-center gap-1">
      <span>Empleado</span>
      {isCreate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          title="Agregar empleado"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setQuickCreateOpen(true);
          }}
        >
          <Plus className="size-3.5" />
          <span className="sr-only">Agregar empleado</span>
        </Button>
      ) : null}
    </span>
  );

  return <>
    {lockTarja ? <HiddenInput source="tarja_id" /> : null}
    {lockEmpleado ? <HiddenInput source="nomina_id" /> : null}
    <HiddenInput source="confirmar_traspaso" />
    <div className="grid gap-1.5 md:grid-cols-3">
      {lockTarja ? (
        <LockedReferenceValue
          label="Tarja"
          primary={defaultValues?.tarja_id ? `#${defaultValues.tarja_id}` : "-"}
          secondary={obraLabel || undefined}
        />
      ) : (
        <FormReferenceAutocomplete
          referenceProps={{ source: "tarja_id", reference: "tarjas" }}
          inputProps={{
            optionText: "descripcion",
            label: "Tarja",
            validate: required(),
          }}
          widthClass="w-full"
        />
      )}
      <LockedReferenceValue
        label="Encargado"
        primary={encargadoLabel || encargadoId || "-"}
        secondary={encargadoId ? `ID contacto ${encargadoId}` : undefined}
      />
      {lockEmpleado ? (
        <LockedReferenceValue
          label="Empleado"
          primary={empleadoLabel || defaultValues?.nomina_id || "-"}
          secondary={
            defaultValues?.nomina_id
              ? `ID nomina ${defaultValues.nomina_id}`
              : undefined
          }
        />
      ) : (
        <FormReferenceAutocomplete
          referenceProps={{
            source: "nomina_id",
            reference: "nominas",
            filter: {
              activo: true,
              idproyecto: null,
            },
            sort: { field: "apellido", order: "ASC" },
          }}
          inputProps={{
            optionText: getEmpleadoLabel,
            inputText: getEmpleadoLabel,
            label: empleadoFieldLabel,
            placeholder: "Seleccionar",
            validate: required(),
          }}
          widthClass="w-full"
        />
      )}
    </div>
    <HiddenInput source="fecha_hasta" />
    <HiddenInput source="tarja_fecha_desde" />
    <HiddenInput source="tarja_fecha_hasta" />
    <div className="mt-1.5 grid gap-1.5 md:grid-cols-3">
      {isCreate ? (
        <FormDate
          source="fecha_desde"
          label="Fecha de ingreso"
          widthClass="w-full"
        />
      ) : (
        <>
          <HiddenInput source="fecha_desde" />
          <LockedReferenceValue
            label="Fecha de ingreso"
            primary={formatDateValue(fechaIngreso)}
          />
        </>
      )}
      <LockedReferenceValue
        label="Fecha de egreso"
        primary={formatDateValue(fechaEgreso)}
      />
    </div>
    <NominaQuickCreateDialog
      open={quickCreateOpen}
      onClose={() => setQuickCreateOpen(false)}
      onCreated={handleEmpleadoCreated}
    />
  </>
};

const SelectedEmpleadoDefaults = () => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const nominaId = Number(useWatch({ name: "nomina_id" }));
  const previousNominaId = useRef<number | undefined>(undefined);
  const { data: empleado } = useGetOne<EmpleadoReference>(
    "nominas",
    { id: nominaId },
    { enabled: Number.isFinite(nominaId) && nominaId > 0 },
  );

  useEffect(() => {
    if (!empleado || previousNominaId.current === nominaId) return;
    previousNominaId.current = nominaId;
    setValue("nomina_categoria_id", empleado.nomina_categoria_id ?? undefined, {
      shouldDirty: false,
    });
    setValue("nomina_tarea_id", empleado.nomina_tarea_id ?? undefined, {
      shouldDirty: false,
    });
  }, [empleado, nominaId, setValue]);

  return null;
};

const TarjaNominaFields = ({
  empleadoCategoriaId,
  empleadoTareaId,
  horasTrabajadas = 0,
}: {
  empleadoCategoriaId?: number | null;
  empleadoTareaId?: number | null;
  horasTrabajadas?: number;
}) => {
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const categoriaValue = useWatch({ name: "nomina_categoria_id" });
  const tareaValue = useWatch({ name: "nomina_tarea_id" });
  const horasJustificadas = useWatch({ name: "horas_justificadas" });
  const horasTrabajadasValue = toAmount(horasTrabajadas);
  const horasTotales = horasTrabajadasValue + toAmount(horasJustificadas);

  useEffect(() => {
    if (!categoriaValue && empleadoCategoriaId) {
      setValue("nomina_categoria_id", empleadoCategoriaId, { shouldDirty: false });
    }
  }, [categoriaValue, empleadoCategoriaId, setValue]);

  useEffect(() => {
    if (!tareaValue && empleadoTareaId) {
      setValue("nomina_tarea_id", empleadoTareaId, { shouldDirty: false });
    }
  }, [empleadoTareaId, setValue, tareaValue]);

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <FormReferenceAutocomplete
        referenceProps={{
          source: "nomina_categoria_id",
          reference: "nomina-categorias",
          filter: { activa: true },
        }}
        inputProps={{
          optionText: "descripcion",
          label: "Categoria",
          placeholder: "Seleccionar",
        }}
        widthClass="w-full"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "nomina_tarea_id",
          reference: "nomina-tareas",
          filter: { activa: true },
        }}
        inputProps={{
          optionText: "descripcion",
          label: "Actividad",
          placeholder: "Seleccionar",
        }}
        widthClass="w-full"
      />
      <div className="grid gap-2 md:col-span-2 md:grid-cols-4">
        <ReadOnlyNumber
          label="Horas Trabajadas"
          value={formatHoursValue(horasTrabajadasValue)}
        />
        <FormNumber
          source="horas_justificadas"
          label="Horas Justificadas"
          min={0}
          step="0.01"
          widthClass="w-full"
        />
        <ReadOnlyNumber
          label="Horas Totales"
          value={formatHoursValue(horasTotales)}
        />
        <FormNumber
          source="adicional_importe"
          label="Adicional"
          min={0}
          step="0.01"
          widthClass="w-full"
        />
      </div>
      <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
        <div className="flex items-end">
          <FormBoolean source="presentismo" label="Presentismo" />
        </div>
        <div className="flex items-end">
          <FormBoolean source="viatico" label="Viatico" />
        </div>
        <div className="flex items-end">
          <FormBoolean source="premio" label="Premio" />
        </div>
      </div>
      <FormTextarea
        source="observaciones"
        label="Observaciones"
        rows={3}
        widthClass="w-full"
        className="md:col-span-2 [&_textarea]:min-h-[72px]"
        maxLength={VALIDATION_RULES.OBSERVACIONES.MAX_LENGTH}
      />
    </div>
  );
};

const TransferAwareToolbar = ({
  proyectoId,
  encargadoId,
  returnTo,
  saveDisabled = false,
}: {
  proyectoId?: number;
  encargadoId?: number;
  returnTo?: string | null;
  saveDisabled?: boolean;
}) => {
  const navigate = useNavigate();
  const { setValue } = useFormContext<TarjaNominaFormValues>();
  const nominaId = useWatch({ name: "nomina_id" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formElement, setFormElement] = useState<HTMLFormElement | null>(null);
  const { data: empleado, isPending: empleadoPending } = useGetOne<EmpleadoReference>(
    "nominas",
    { id: Number(nominaId) },
    { enabled: Number.isFinite(Number(nominaId)) && Number(nominaId) > 0 },
  );
  const requiereTraspaso = Boolean(
    empleado &&
      ((empleado.idproyecto != null && empleado.idproyecto !== proyectoId) ||
        (empleado.encargado_contacto_id != null &&
          empleado.encargado_contacto_id !== encargadoId)),
  );

  useEffect(() => {
    if (!requiereTraspaso) {
      setValue("confirmar_traspaso", false, { shouldDirty: false });
    }
  }, [requiereTraspaso, setValue]);

  const handleSaveClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (saveDisabled) {
      event.preventDefault();
      return;
    }
    if (!requiereTraspaso) return;
    event.preventDefault();
    setFormElement(event.currentTarget.form);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setValue("confirmar_traspaso", true, { shouldDirty: true });
    setConfirmOpen(false);
    queueMicrotask(() => formElement?.requestSubmit());
  };

  return (
    <>
      <FormOrderToolbar
        cancelProps={
          returnTo
            ? {
                onClick: () => navigate(returnTo),
              }
            : undefined
        }
        saveProps={{
          onClick: handleSaveClick,
          disabled: saveDisabled || (Boolean(nominaId) && empleadoPending),
        }}
      />
      <Confirm
        isOpen={confirmOpen}
        title="Confirmar traspaso"
        content="El empleado pertenece a otra nomina. Se registrara la baja el dia anterior y el alta en la nomina actual."
        confirm="Traspasar"
        cancel="Cancelar"
        confirmColor="warning"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

const TarjaLiquidacionFields = () => {
  const [
    presentismoImporte,
    premioImporte,
    viaticoImporte,
    sueldoImporte,
    cargasImporte,
    mejoraImporte,
    adicionalImporte,
  ] = useWatch<TarjaNominaFormValues>({
    name: [
      "presentismo_importe",
      "premio_importe",
      "viatico_importe",
      "sueldo_importe",
      "cargas_importe",
      "mejora_importe",
      "adicional_importe",
    ],
  });

  const total =
    toAmount(presentismoImporte) +
    toAmount(premioImporte) +
    toAmount(viaticoImporte) +
    toAmount(sueldoImporte) +
    toAmount(cargasImporte) +
    toAmount(mejoraImporte) +
    toAmount(adicionalImporte);

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Presentismo"
          value={formatMoney(toAmount(presentismoImporte))}
        />
        <ReadOnlyNumber
          label="Sueldo"
          value={formatMoney(toAmount(sueldoImporte))}
        />
        <ReadOnlyNumber
          label="Cargas"
          value={formatMoney(toAmount(cargasImporte))}
        />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Adicional"
          value={formatMoney(toAmount(adicionalImporte))}
        />
        <ReadOnlyNumber
          label="Viatico"
          value={formatMoney(toAmount(viaticoImporte))}
        />
        <ReadOnlyNumber
          label="Premio"
          value={formatMoney(toAmount(premioImporte))}
        />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ReadOnlyNumber
          label="Mejoras"
          value={formatMoney(toAmount(mejoraImporte))}
        />
        <ReadOnlyNumber
          label="Total"
          value={formatMoney(total)}
          strong
        />
      </div>
    </div>
  );
};

const TarjaNominaDocumentosFields = ({
  registroId,
  readOnly = false,
}: {
  registroId?: number;
  readOnly?: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawDocumentos = useWatch<TarjaNominaFormValues>({ name: "documentos" });
  const documentos = (Array.isArray(rawDocumentos) ? rawDocumentos : [])
    .map(parseDocumento)
    .filter((item): item is TarjaNominaDocumento => Boolean(item));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [documentoAEliminar, setDocumentoAEliminar] = useState<TarjaNominaDocumento | null>(null);
  const { upload, loading: uploading } = useTarjaNominaDocumentoUpload();
  const { deleteDocumento, loading: deleting } = useTarjaNominaDocumentoDelete();

  const disabled = readOnly || !registroId;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNombre(file.name);
    setConfirmUploadOpen(true);
    event.target.value = "";
  };

  const handleUpload = async () => {
    if (!registroId || !pendingFile) return;
    const ok = await upload(registroId, pendingFile, nombre.trim() || pendingFile.name);
    if (!ok) return;
    setPendingFile(null);
    setNombre("");
    setConfirmUploadOpen(false);
  };

  const handleCancelUpload = () => {
    setPendingFile(null);
    setNombre("");
    setConfirmUploadOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!registroId || !documentoAEliminar) return;
    const ok = await deleteDocumento(registroId, documentoAEliminar.url);
    if (ok) setDocumentoAEliminar(null);
  };

  if (!registroId) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Guarda el registro de nomina para adjuntar certificados y otros documentos.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Certificados y documentos asociados a esta nomina de la quincena.
        </p>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            Subir
          </Button>
        ) : null}
      </div>
      {documentos.length ? (
        <ul className="divide-y rounded-md border bg-white text-[12px]">
          {documentos.map((documento) => {
            const resolvedUrl = getDocumentoUrl(documento.url);
            return (
              <li key={documento.url} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate" title={documento.nombre}>
                    {documento.nombre}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ArchivoViewerModal url={resolvedUrl} nombre={documento.nombre} />
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={deleting}
                      onClick={() => setDocumentoAEliminar(documento)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
          Sin documentos adjuntos.
        </p>
      )}
      <Dialog
        open={confirmUploadOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelUpload();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>
              El archivo quedara asociado a esta nomina dentro de la quincena.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              disabled={uploading}
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelUpload} disabled={uploading}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(documentoAEliminar)}
        onOpenChange={(open) => {
          if (!open) setDocumentoAEliminar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
            <DialogDescription>
              Se quitara el documento de esta nomina de la quincena.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            {documentoAEliminar?.nombre ?? "Documento"}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDocumentoAEliminar(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteConfirm()} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type TarjaNominaFormProps = {
  defaultValues?: Partial<TarjaNominaFormValues>;
  lockReferences?: boolean;
};

export const TarjaNominaForm = ({
  defaultValues,
  lockReferences = false,
}: TarjaNominaFormProps = {}) => {
  const location = useLocation();
  const record = useRecordContext<
    Partial<TarjaNominaFormValues> & {
      id?: number | string;
      empleado?: string | null;
      obra?: string | null;
      encargado?: string | null;
      proyecto_id?: number | null;
      encargado_id?: number | null;
      tipo_novedad?: string | null;
      editable?: boolean | null;
    }
  >();
  const params = new URLSearchParams(location.search);
  const effectiveValues = {
    ...TARJA_NOMINA_DEFAULT,
    ...record,
    ...(defaultValues ?? {}),
  };
  const lockTarja = lockReferences || Boolean(effectiveValues.tarja_id);
  const lockEmpleado = Boolean(effectiveValues.nomina_id);
  const proyectoId =
    toOptionalId(params.get("proyecto_id")) ??
    toOptionalId(record?.proyecto_id);
  const encargadoId =
    toOptionalId(params.get("encargado_id")) ??
    toOptionalId(record?.encargado_id);
  const obraLabel = params.get("obra") || record?.obra || undefined;
  const encargadoLabelFromContext =
    params.get("encargado") || record?.encargado || undefined;
  const nominaId =
    effectiveValues.nomina_id == null ? undefined : Number(effectiveValues.nomina_id);
  const { data: empleado } = useGetOne<{
    id: number | string;
    apellido?: string | null;
    nombre?: string | null;
    nombre_completo?: string | null;
    dni?: string | null;
    nomina_categoria_id?: number | null;
    nomina_tarea_id?: number | null;
  }>(
    "nominas",
    { id: nominaId as number },
    { enabled: Number.isFinite(nominaId) && Boolean(nominaId) },
  );
  const empleadoLabel =
    empleado?.nombre_completo ||
    (empleado ? getEmpleadoLabel(empleado) : record?.empleado || "");
  const { data: proyecto } = useGetOne<{
    id: number | string;
    nombre?: string | null;
  }>(
    "proyectos",
    { id: proyectoId as number },
    {
      enabled:
        Number.isFinite(proyectoId) && Boolean(proyectoId) && !obraLabel,
    },
  );
  const resolvedObraLabel = obraLabel || proyecto?.nombre || "";
  const { data: encargado } = useGetOne<{
    id: number | string;
    nombre_completo?: string | null;
    nombre?: string | null;
  }>(
    "crm/contactos",
    { id: encargadoId as number },
    {
      enabled:
        Number.isFinite(encargadoId) &&
        Boolean(encargadoId) &&
        !encargadoLabelFromContext,
    },
  );
  const encargadoLabel =
    encargadoLabelFromContext ||
    encargado?.nombre_completo ||
    encargado?.nombre ||
    "";
  const returnTo = params.get("returnTo");
  const horasTrabajadasParam = params.get("horas_trabajadas");
  const horasTrabajadas = toAmount(horasTrabajadasParam);
  const isCreate = !record?.id;
  const isReadOnlyNovedad =
    record?.editable === false || record?.tipo_novedad === "ALT";

  return (
    <SimpleForm<TarjaNominaFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(tarjaNominaSchema) as any}
      toolbar={
        <TransferAwareToolbar
          proyectoId={proyectoId}
          encargadoId={encargadoId}
          returnTo={returnTo}
          saveDisabled={isReadOnlyNovedad}
        />
      }
      defaultValues={effectiveValues}
    >
      <SelectedEmpleadoDefaults />
      <SectionBaseTemplate
        title="Cabecera"
        main={
          <TarjaNominaHeaderFields
            lockTarja={lockTarja}
            lockEmpleado={lockEmpleado}
            defaultValues={effectiveValues}
            empleadoLabel={empleadoLabel}
            obraLabel={resolvedObraLabel}
            encargadoId={encargadoId}
            encargadoLabel={encargadoLabel}
            isCreate={isCreate}
          />
        }
        defaultOpen
      />
      <SectionBaseTemplate
        title="Datos de nomina"
        main={
          <TarjaNominaFields
            empleadoCategoriaId={empleado?.nomina_categoria_id}
            empleadoTareaId={empleado?.nomina_tarea_id}
            horasTrabajadas={horasTrabajadas}
          />
        }
        defaultOpen
      />
      <SectionBaseTemplate
        title="Documentos"
        main={
          <TarjaNominaDocumentosFields
            registroId={record?.id ? Number(record.id) : undefined}
            readOnly={isReadOnlyNovedad}
          />
        }
        defaultOpen={false}
      />
      <SectionBaseTemplate
        title="Liquidacion"
        main={<TarjaLiquidacionFields />}
        defaultOpen={false}
      />
    </SimpleForm>
  );
};
