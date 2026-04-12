"use client";

import { useState } from "react";
import { useNotify, useRefresh } from "ra-core";
import { apiUrl } from "@/lib/dataProvider";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
      notify(`Contrato renovado. Nuevo contrato #${data?.nuevo_contrato_id ?? ""}`, {
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
