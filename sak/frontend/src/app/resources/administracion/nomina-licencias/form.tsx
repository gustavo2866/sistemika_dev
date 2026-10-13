"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  required,
  useGetList,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { useRef, useState, type ChangeEvent } from "react";
import { useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { FormOrderCancelButton } from "@/components/forms";
import {
  ArchivoViewerModal,
  FormDate,
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormSelect,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/dataProvider";
import { FileText, Trash2, Upload } from "lucide-react";

import {
  NOMINA_LICENCIA_DEFAULT,
  nominaLicenciaSchema,
  parseNominaLicenciaDocumento,
  VALIDATION_RULES,
  type NominaLicencia,
  type NominaLicenciaDocumento,
  type NominaLicenciaFormValues,
} from "./model";
import { NominaLicenciaSaveButton } from "./impact-confirmation";

type NominaChoice = {
  nombre?: string | null;
  apellido?: string | null;
  nro_legajo?: string | null;
};

type ParteDiarioEstadoChoice = {
  abreviatura?: string | null;
  nombre?: string | null;
};

export type NominaLicenciaPendingDocumento = {
  id: string;
  file: File;
  nombre: string;
};

const getNominaLabel = (choice?: unknown) => {
  const record = choice as NominaChoice | undefined;
  const nombreCompleto = [record?.apellido, record?.nombre]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const legajo = String(record?.nro_legajo ?? "").trim();

  return [nombreCompleto || "Empleado", legajo ? `Legajo ${legajo}` : null]
    .filter(Boolean)
    .join(" · ");
};

const getTipoLicenciaLabel = (choice?: unknown) => {
  const record = choice as ParteDiarioEstadoChoice | undefined;
  const abreviatura = String(record?.abreviatura ?? "").trim();
  const nombre = String(record?.nombre ?? "").trim();
  return [abreviatura, nombre].filter(Boolean).join(" - ");
};

const TipoLicenciaInput = () => {
  const { data: tiposLicencia = [], isPending } =
    useGetList<ParteDiarioEstadoChoice & { id: number }>(
      "parte-diario-estados",
      {
        pagination: { page: 1, perPage: 100 },
        filter: { licencia: true },
        sort: { field: "nombre", order: "ASC" },
      },
    );

  return (
    <FormSelect
      source="tipo_novedad"
      choices={tiposLicencia}
      optionText={getTipoLicenciaLabel}
      optionValue="abreviatura"
      label="Tipo de licencia"
      emptyText={isPending ? "Cargando..." : "Seleccionar"}
      validate={required()}
      disabled={isPending}
      widthClass="w-full"
    />
  );
};

const NominaLicenciaFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormReferenceAutocomplete
      referenceProps={{ source: "nomina_id", reference: "nominas" }}
      inputProps={{
        optionText: getNominaLabel,
        inputText: getNominaLabel,
        label: "Empleado",
        placeholder: "Seleccionar empleado",
        validate: required(),
      }}
      widthClass="w-full"
    />
    <TipoLicenciaInput />
    <FormDate
      source="fecha_desde"
      label="Fecha desde"
      validate={required()}
      widthClass="w-full"
    />
    <FormDate
      source="fecha_hasta"
      label="Fecha hasta"
      widthClass="w-full"
    />
    <FormTextarea
      source="comentario"
      label="Comentario"
      rows={4}
      widthClass="w-full"
      className="md:col-span-2 [&_textarea]:min-h-[88px]"
      maxLength={VALIDATION_RULES.COMENTARIO.MAX_LENGTH}
    />
  </div>
);

const buildAuthHeaders = () => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("auth_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const uploadNominaLicenciaDocumento = async (
  registroId: number,
  documento: Pick<NominaLicenciaPendingDocumento, "file" | "nombre">,
) => {
  const formData = new FormData();
  formData.append("file", documento.file);
  formData.append("nombre", documento.nombre.trim() || documento.file.name);
  const response = await fetch(
    `${apiUrl}/nomina-licencias/${registroId}/documentos`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      body: formData,
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail ?? "No se pudo subir el documento");
  }
  return response.json();
};

const getDocumentoUrl = (url: string) => {
  if (url.startsWith("gs://")) {
    return url.replace(
      /^gs:\/\/([^/]+)\/(.+)$/,
      "https://storage.googleapis.com/$1/$2",
    );
  }
  return url.startsWith("/") ? `${apiUrl}${url}` : url;
};

const NominaLicenciaDocumentosFields = ({
  registroId,
  pendingDocumentos = [],
  onPendingDocumentosChange,
}: {
  registroId?: number;
  pendingDocumentos?: NominaLicenciaPendingDocumento[];
  onPendingDocumentosChange?: (
    documentos: NominaLicenciaPendingDocumento[],
  ) => void;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawDocumentos = useWatch<NominaLicenciaFormValues>({
    name: "documentos",
  });
  const documentos = (Array.isArray(rawDocumentos) ? rawDocumentos : [])
    .map(parseNominaLicenciaDocumento)
    .filter((item): item is NominaLicenciaDocumento => Boolean(item));
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [documentoAEliminar, setDocumentoAEliminar] =
    useState<NominaLicenciaDocumento | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNombre(file.name);
    setConfirmUploadOpen(true);
    event.target.value = "";
  };

  const handleCancelUpload = () => {
    setPendingFile(null);
    setNombre("");
    setConfirmUploadOpen(false);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;

    if (!registroId) {
      if (pendingDocumentos.length >= VALIDATION_RULES.DOCUMENTOS.MAX_ITEMS) {
        notify(
          `Solo se permiten ${VALIDATION_RULES.DOCUMENTOS.MAX_ITEMS} documentos por licencia`,
          { type: "warning" },
        );
        return;
      }
      onPendingDocumentosChange?.([
        ...pendingDocumentos,
        {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${pendingDocumentos.length}`,
          file: pendingFile,
          nombre: nombre.trim() || pendingFile.name,
        },
      ]);
      notify("Documento listo para subir al guardar", { type: "info" });
      handleCancelUpload();
      return;
    }

    setUploading(true);
    try {
      await uploadNominaLicenciaDocumento(registroId, {
        file: pendingFile,
        nombre,
      });
      notify("Documento subido", { type: "info" });
      handleCancelUpload();
      refresh();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Error al subir el documento",
        { type: "warning" },
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!registroId || !documentoAEliminar) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `${apiUrl}/nomina-licencias/${registroId}/documentos`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...buildAuthHeaders(),
          },
          body: JSON.stringify({ url: documentoAEliminar.url }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload?.detail ?? "No se pudo eliminar el documento", {
          type: "warning",
        });
        return;
      }
      notify("Documento eliminado", { type: "info" });
      setDocumentoAEliminar(null);
      refresh();
    } catch {
      notify("Error al eliminar el documento", { type: "warning" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {registroId
            ? "Certificados y comprobantes asociados a esta licencia."
            : "Seleccioná los documentos; se subirán al guardar la licencia."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Subir
        </Button>
      </div>
      {documentos.length ? (
        <ul className="divide-y rounded-md border bg-white text-[12px]">
          {documentos.map((documento) => (
            <li
              key={documento.url}
              className="flex items-center justify-between gap-2 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={documento.nombre}>
                  {documento.nombre}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ArchivoViewerModal
                  url={getDocumentoUrl(documento.url)}
                  nombre={documento.nombre}
                />
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
              </div>
            </li>
          ))}
        </ul>
      ) : (
        null
      )}
      {pendingDocumentos.length ? (
        <ul className="divide-y rounded-md border bg-white text-[12px]">
          {pendingDocumentos.map((documento) => (
            <li
              key={documento.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={documento.nombre}>
                  {documento.nombre}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Pendiente
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onPendingDocumentosChange?.(
                    pendingDocumentos.filter((item) => item.id !== documento.id),
                  )
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {!documentos.length && !pendingDocumentos.length ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
          Sin documentos adjuntos.
        </p>
      ) : null}

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
              El archivo quedará asociado a esta licencia de nómina.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre
            </label>
            <Input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              disabled={uploading}
              className="h-9 text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelUpload}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
            >
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
              Se quitará el documento de esta licencia y del almacenamiento.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            {documentoAEliminar?.nombre ?? "Documento"}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDocumentoAEliminar(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type NominaLicenciaFormProps = {
  cancelTo?: string;
  pendingDocumentos?: NominaLicenciaPendingDocumento[];
  onPendingDocumentosChange?: (
    documentos: NominaLicenciaPendingDocumento[],
  ) => void;
};

export const NominaLicenciaForm = ({
  cancelTo,
  pendingDocumentos,
  onPendingDocumentosChange,
}: NominaLicenciaFormProps = {}) => {
  const record = useRecordContext<NominaLicencia>();
  const navigate = useNavigate();

  return (
    <SimpleForm<NominaLicenciaFormValues>
      className="w-full max-w-3xl"
      resolver={zodResolver(nominaLicenciaSchema) as any}
      toolbar={
        <div className="flex w-full items-center justify-end gap-2">
          <FormOrderCancelButton
            {...(cancelTo ? { onClick: () => navigate(cancelTo) } : {})}
          />
          <NominaLicenciaSaveButton />
        </div>
      }
      defaultValues={NOMINA_LICENCIA_DEFAULT}
    >
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Datos de la licencia"
        main={<NominaLicenciaFields />}
        defaultOpen
      />
      <SectionBaseTemplate
        title="Documentos"
        main={
          <NominaLicenciaDocumentosFields
            registroId={record?.id ? Number(record.id) : undefined}
            pendingDocumentos={pendingDocumentos}
            onPendingDocumentosChange={onPendingDocumentosChange}
          />
        }
        defaultOpen={false}
      />
    </SimpleForm>
  );
};
