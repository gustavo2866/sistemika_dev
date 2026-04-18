"use client";

import { useCallback, useEffect, useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { apiUrl } from "@/lib/dataProvider";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Generar PDF ──────────────────────────────────────────────────────────────

export const useContratoGenerarPdf = () => {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const downloadPreview = useCallback(() => {
    if (!previewUrl || !previewName) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = previewName;
    a.click();
  }, [previewName, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const generarPdf = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/pdf`, {
        method: "GET",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo generar el PDF", { type: "warning" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setPreviewName(`contrato_${id}.pdf`);
      setPreviewOpen(true);
    } catch {
      notify("Error al generar el PDF", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return {
    generarPdf,
    loading,
    previewUrl,
    previewName,
    previewOpen,
    closePreview,
    downloadPreview,
  };
};

// ── Activar ──────────────────────────────────────────────────────────────────

export const useContratoActivar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const activar = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/activar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo activar el contrato", { type: "warning" });
        return false;
      }
      refresh();
      notify("Contrato activado", { type: "info" });
      return true;
    } catch {
      notify("Error al activar el contrato", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { activar, loading };
};

// ── Rescindir ────────────────────────────────────────────────────────────────

export type RescindirPayload = {
  fecha_rescision: string;
  motivo_rescision?: string | null;
};

export const useContratoRescindir = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const rescindir = async (id: number, payload: RescindirPayload) => {
    if (!payload.fecha_rescision) {
      notify("Ingresa la fecha de rescisión", { type: "warning" });
      return false;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/rescindir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo rescindir el contrato", { type: "warning" });
        return false;
      }
      refresh();
      notify("Contrato rescindido", { type: "info" });
      return true;
    } catch {
      notify("Error al rescindir el contrato", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { rescindir, loading };
};

// ── Finalizar ────────────────────────────────────────────────────────────────

export const useContratoFinalizar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const finalizar = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo finalizar el contrato", { type: "warning" });
        return false;
      }
      refresh();
      notify("Contrato finalizado", { type: "info" });
      return true;
    } catch {
      notify("Error al finalizar el contrato", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { finalizar, loading };
};

// ── Renovar ──────────────────────────────────────────────────────────────────

export const useContratoRenovar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const renovar = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/renovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo renovar el contrato", { type: "warning" });
        return false;
      }
      const data = await res.json();
      refresh();
      notify(`Contrato renovado. Contrato activo #${data?.nuevo_contrato_id ?? ""}`, {
        type: "info",
      });
      return true;
    } catch {
      notify("Error al renovar el contrato", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { renovar, loading };
};

// ── Duplicar ─────────────────────────────────────────────────────────────────

export const useContratoDuplicar = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const duplicar = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${id}/duplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo duplicar el contrato", { type: "warning" });
        return false;
      }
      const data = await res.json();
      refresh();
      notify(`Contrato duplicado. Nuevo contrato #${data?.nuevo_contrato_id ?? ""}`, {
        type: "info",
      });
      return true;
    } catch {
      notify("Error al duplicar el contrato", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { duplicar, loading };
};

// ── Archivo: upload ───────────────────────────────────────────────────────────

export const useContratoArchivoUpload = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const upload = async (contratoId: number, file: File, nombre?: string, tipo?: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (nombre) formData.append("nombre", nombre);
      if (tipo) formData.append("tipo", tipo);

      const res = await fetch(`${apiUrl}/contratos/${contratoId}/archivos`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo subir el archivo", { type: "warning" });
        return false;
      }
      refresh();
      notify("Archivo subido", { type: "info" });
      return true;
    } catch {
      notify("Error al subir el archivo", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading };
};

// ── Archivo: eliminar ─────────────────────────────────────────────────────────

export const useContratoArchivoDelete = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const deleteArchivo = async (contratoId: number, archivoId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${contratoId}/archivos/${archivoId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo eliminar el archivo", { type: "warning" });
        return false;
      }
      refresh();
      notify("Archivo eliminado", { type: "info" });
      return true;
    } catch {
      notify("Error al eliminar el archivo", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { deleteArchivo, loading };
};
