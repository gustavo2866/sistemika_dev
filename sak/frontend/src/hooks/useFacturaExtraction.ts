"use client";

import { useCallback, useState } from "react";
import { useNotify } from "ra-core";

type ExtractionStatus = "idle" | "uploading" | "extracting" | "success" | "error";

type FacturaExtractionResponse = {
  success?: boolean;
  data?: Record<string, unknown> | null;
  file_path?: string | null;
  stored_filename?: string | null;
  nombre_archivo_pdf?: string | null;
  nombre_archivo_pdf_guardado?: string | null;
  ruta_archivo_pdf?: string | null;
  comprobante_id?: number | null;
  message?: string;
};

interface ExtractParams {
  file: File;
  proveedorId: number;
  tipoOperacionId: number;
  extractionMethod?: string;
}

interface UseFacturaExtractionOptions {
  onSuccess?: (response: FacturaExtractionResponse) => void;
  onError?: (error: Error) => void;
}

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const buildHeaders = () => {
  const headers = new Headers();
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
};

export function useFacturaExtraction(options: UseFacturaExtractionOptions = {}) {
  const [status, setStatus] = useState<ExtractionStatus>("idle");
  const notify = useNotify();

  const extract = useCallback(async ({
    file,
    proveedorId,
    tipoOperacionId,
    extractionMethod = "auto",
  }: ExtractParams): Promise<FacturaExtractionResponse | null> => {
    if (!file) {
      notify("Debe seleccionar un archivo PDF", { type: "warning" });
      return null;
    }

    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("proveedor_id", String(proveedorId));
      formData.append("tipo_operacion_id", String(tipoOperacionId));
      formData.append("extraction_method", extractionMethod);
      formData.append("is_pdf", "true");

      const response = await fetch(`${apiBase}/api/v1/facturas/parse-pdf/`, {
        method: "POST",
        body: formData,
        headers: buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Error (${response.status}): ${response.statusText}`);
      }

      setStatus("extracting");
      const payload = (await response.json()) as FacturaExtractionResponse;

      if (!payload?.success) {
        throw new Error(payload?.message ?? "Error al procesar el PDF");
      }

      setStatus("success");
      notify("Archivo procesado correctamente", { type: "success" });
      options.onSuccess?.(payload);
      return payload;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Error desconocido");
      setStatus("error");
      notify(err.message, { type: "error" });
      options.onError?.(err);
      return null;
    }
  }, [notify, options]);

  const reset = useCallback(() => setStatus("idle"), []);

  return {
    extract,
    status,
    isUploading: status === "uploading" || status === "extracting",
    reset,
  };
}
