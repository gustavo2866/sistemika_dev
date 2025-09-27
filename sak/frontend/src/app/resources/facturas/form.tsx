"use client";

import { useCallback, useMemo, useRef } from "react";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FormControl, FormError, FormField, FormLabel } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useNotify, useInput } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { useFacturaExtraction } from "@/hooks/useFacturaExtraction";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const normalizeFilePath = (value?: unknown): string | undefined => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const cleaned = value.replace(/\\+/g, "/");
  if (cleaned.startsWith("http")) {
    return cleaned;
  }
  const relative = cleaned.startsWith("/uploads")
    ? cleaned
    : cleaned.includes("uploads/")
      ? `/${cleaned.slice(cleaned.indexOf("uploads/"))}`
      : cleaned.startsWith("/")
        ? cleaned
        : `/uploads/facturas/${cleaned}`;
  return `${apiBase}${relative}`;
};

const facturaEstadoChoices = [
  { id: "pendiente", name: "Pendiente" },
  { id: "procesada", name: "Procesada" },
  { id: "aprobada", name: "Aprobada" },
  { id: "rechazada", name: "Rechazada" },
  { id: "pagada", name: "Pagada" },
  { id: "anulada", name: "Anulada" },
];

const HiddenInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return <input type="hidden" {...field} />;
};

const ArchivoField = ({
  onUpload,
  downloading,
  downloadUrl,
}: {
  onUpload: () => void;
  downloading: boolean;
  downloadUrl?: string;
}) => {
  const { id, field } = useInput({ source: "nombre_archivo_pdf" });

  return (
    <FormField id={id} name={field.name}>
      <FormLabel>Archivo PDF</FormLabel>
      <FormControl>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input {...field} readOnly className="sm:flex-1" />
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {downloadUrl ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                asChild
              >
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  <FileText className="h-4 w-4" />
                  <span className="sr-only">Abrir PDF</span>
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onUpload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="sr-only">Subir PDF</span>
            </Button>
          </div>
        </div>
      </FormControl>
      <FormError />
    </FormField>
  );
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const normalised = value
      .replace(/[^\d,.-]/g, "")
      .replace(/,(\d{2})$/, ".$1");
    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toDateString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return undefined;
};

const useFacturaFormExtraction = () => {
  const notify = useNotify();
  const form = useFormContext();
  const { extract, isUploading } = useFacturaExtraction({
    onSuccess: (result) => {
      if (!form) return;
      const setValue = form.setValue;
      const data = (result?.data ?? {}) as Record<string, unknown>;

      const numero = data.numero ?? data.numero_comprobante;
      if (numero !== undefined) {
        setValue("numero", String(numero ?? ""), { shouldDirty: true });
      }

      const puntoVenta = data.punto_venta;
      if (puntoVenta !== undefined) {
        setValue("punto_venta", String(puntoVenta ?? ""), { shouldDirty: true });
      }

      const tipoComprobante = data.tipo_comprobante ?? data.tipo;
      if (typeof tipoComprobante === "string") {
        setValue("tipo_comprobante", tipoComprobante, { shouldDirty: true });
      }

      const fechaEmision = toDateString(data.fecha_emision);
      if (fechaEmision) {
        setValue("fecha_emision", fechaEmision, { shouldDirty: true });
      }

      const fechaVencimiento = toDateString(data.fecha_vencimiento);
      if (fechaVencimiento) {
        setValue("fecha_vencimiento", fechaVencimiento, { shouldDirty: true });
      }

      const subtotal = toNumber(data.subtotal);
      if (subtotal !== undefined) {
        setValue("subtotal", subtotal, { shouldDirty: true });
      }

      const totalImpuestos = toNumber(data.total_impuestos);
      if (totalImpuestos !== undefined) {
        setValue("total_impuestos", totalImpuestos, { shouldDirty: true });
      }

      const total = toNumber(data.total);
      if (total !== undefined) {
        setValue("total", total, { shouldDirty: true });
      }

      const nombreArchivo =
        result?.nombre_archivo_pdf ??
        (typeof data.nombre_archivo_pdf === "string" ? data.nombre_archivo_pdf : undefined) ??
        (typeof result?.stored_filename === "string" ? result.stored_filename : undefined);
      if (nombreArchivo) {
        setValue("nombre_archivo_pdf", nombreArchivo, { shouldDirty: true });
      }

      const rutaArchivo =
        result?.ruta_archivo_pdf ??
        result?.file_path ??
        (typeof data.ruta_archivo_pdf === "string" ? data.ruta_archivo_pdf : undefined) ??
        (typeof result?.stored_filename === "string" ? `uploads/facturas/${result.stored_filename}` : undefined);
      if (rutaArchivo) {
        setValue("ruta_archivo_pdf", rutaArchivo, { shouldDirty: true });
      }

      if (result?.comprobante_id !== undefined) {
        setValue("comprobante_id", result.comprobante_id ?? null, { shouldDirty: true });
      }
    },
  });

  const handleExtract = useCallback(
    async (file: File, proveedorId?: number, tipoOperacionId?: number) => {
      if (!file) return;
      if (!proveedorId || !tipoOperacionId) {
        notify("Seleccione proveedor y tipo de operaci\u00f3n antes de subir el PDF", { type: "warning" });
        return;
      }
      await extract({ file, proveedorId, tipoOperacionId });
    },
    [extract, notify],
  );

  return { handleExtract, isUploading };
};

const FacturaFormFields = () => {
  const { handleExtract, isUploading } = useFacturaFormExtraction();
  const proveedorId = useWatch({ name: "proveedor_id" });
  const tipoOperacionId = useWatch({ name: "tipo_operacion_id" });
  const rutaArchivo = useWatch({ name: "ruta_archivo_pdf" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const downloadUrl = useMemo(() => normalizeFilePath(rutaArchivo), [rutaArchivo]);

  const onUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      void handleExtract(file, proveedorId, tipoOperacionId);
      // reset input so same file can be re-selected
      event.target.value = "";
    },
    [handleExtract, proveedorId, tipoOperacionId],
  );

  return (
    <div className="flex flex-col gap-6">
      <ArchivoField onUpload={onUpload} downloading={isUploading} downloadUrl={downloadUrl} />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
      <HiddenInput source="ruta_archivo_pdf" />
      <HiddenInput source="comprobante_id" />

      <div className="grid gap-4 md:grid-cols-2">
        <ReferenceInput source="proveedor_id" reference="proveedores" label="Proveedor" isRequired>
          <SelectInput optionText="nombre" emptyText="Seleccionar proveedor" className="w-full" />
        </ReferenceInput>
        <ReferenceInput source="tipo_operacion_id" reference="tipos-operacion" label="Tipo de Operaci\u00f3n" isRequired>
          <SelectInput optionText="descripcion" emptyText="Seleccionar tipo" className="w-full" />
        </ReferenceInput>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReferenceInput source="usuario_responsable_id" reference="users" label="Usuario Responsable" isRequired>
          <SelectInput optionText="nombre" emptyText="Seleccionar usuario" className="w-full" />
        </ReferenceInput>
        <SelectInput source="estado" label="Estado" choices={facturaEstadoChoices} defaultValue="pendiente" className="w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TextInput source="numero" label="N\u00famero" isRequired className="w-full" />
        <TextInput source="punto_venta" label="Punto de Venta" isRequired className="w-full" />
        <SelectInput
          source="tipo_comprobante"
          label="Tipo de Comprobante"
          choices={[
            { id: "A", name: "Factura A" },
            { id: "B", name: "Factura B" },
            { id: "C", name: "Factura C" },
            { id: "M", name: "Factura M" },
            { id: "NC", name: "Nota de Cr\u00e9dito" },
            { id: "ND", name: "Nota de D\u00e9bito" },
          ]}
          className="w-full"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput source="fecha_emision" label="Fecha de Emisi\u00f3n" type="date" isRequired className="w-full" />
        <TextInput source="fecha_vencimiento" label="Fecha de Vencimiento" type="date" className="w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NumberInput source="subtotal" label="Subtotal" step={0.01} isRequired className="w-full" />
        <NumberInput source="total_impuestos" label="Total Impuestos" step={0.01} isRequired className="w-full" />
        <NumberInput source="total" label="Total" step={0.01} isRequired className="w-full" />
      </div>

      <TextInput source="observaciones" label="Observaciones" multiline rows={3} className="w-full" />
    </div>
  );
};

export const FacturaForm = () => (
  <SimpleForm className="w-full max-w-5xl" defaultValues={{ estado: "pendiente" }}>
    <FacturaFormFields />
  </SimpleForm>
);














