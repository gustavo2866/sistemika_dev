"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useGetList, useGetOne, useNotify, useRefresh } from "ra-core";
import { apiUrl } from "@/lib/dataProvider";
import { resolveNumericId } from "@/components/forms/form_order";
import type { ContratoFormValues } from "./model";

type SettingRecord = {
  id: number;
  clave: string;
  valor?: string | null;
};

type TipoContratoRecord = {
  id: number;
  nombre?: string | null;
};

type TipoActualizacionRecord = {
  id: number;
  nombre?: string | null;
  cantidad_meses?: number | null;
};

type PropiedadContactoRecord = {
  id: number;
  contacto_id?: unknown;
};

type CRMContactoRecord = {
  id: number;
  nombre_completo?: string | null;
  telefonos?: unknown;
  email?: string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const useDefaultTipoContratoId = () => {
  const { data: defaultTipoSettings = [] } = useGetList<SettingRecord>("settings", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: { clave: "INM_Default_Tipo" },
  });
  const tipoDefault = String(defaultTipoSettings[0]?.valor ?? "").trim();

  const { data: tiposContratoExact = [] } = useGetList<TipoContratoRecord>(
    "tipos-contrato",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { nombre: tipoDefault },
    },
    { enabled: Boolean(tipoDefault) && !resolveNumericId(tipoDefault) },
  );

  const { data: tiposContratoSearch = [] } = useGetList<TipoContratoRecord>(
    "tipos-contrato",
    {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
      filter: { q: tipoDefault },
    },
    { enabled: Boolean(tipoDefault) && !resolveNumericId(tipoDefault) },
  );

  return useMemo(() => {
    if (!tipoDefault) return null;
    return (
      resolveNumericId(tipoDefault) ??
      resolveNumericId(tiposContratoExact[0]?.id) ??
      resolveNumericId(tiposContratoSearch[0]?.id)
    );
  }, [tipoDefault, tiposContratoExact, tiposContratoSearch]);
};

export const useDefaultLugarCelebracion = () => {
  const { data: defaultLugarSettings = [] } = useGetList<SettingRecord>("settings", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: { clave: "INM_Default_Lugar" },
  });

  return useMemo(() => {
    const lugar = String(defaultLugarSettings[0]?.valor ?? "").trim();
    return lugar || null;
  }, [defaultLugarSettings]);
};

export const useTiposActualizacionCatalog = () => {
  const { data: tiposActualizacion = [] } = useGetList<TipoActualizacionRecord>(
    "tipos-actualizacion",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "nombre", order: "ASC" },
    },
  );

  return tiposActualizacion as TipoActualizacionRecord[];
};

export const useCantidadMesesTipoActualizacion = (
  tipoActualizacionId?: number | null,
) => {
  const tiposActualizacion = useTiposActualizacionCatalog();

  return useMemo(() => {
    if (!tipoActualizacionId) return 0;
    return Number(
      tiposActualizacion.find(
        (tipo) => resolveNumericId(tipo?.id) === tipoActualizacionId,
      )?.cantidad_meses ?? 0,
    );
  }, [tipoActualizacionId, tiposActualizacion]);
};

export const calculateFechaRenovacionFromInicio = (
  fechaInicio?: string | null,
  cantidadMeses?: number | null,
) => {
  if (!fechaInicio || !cantidadMeses || cantidadMeses <= 0) return "";

  const base = new Date(fechaInicio);
  if (Number.isNaN(base.getTime())) return "";

  const baseYear = base.getFullYear();
  const baseMonth = base.getMonth();
  const baseDay = base.getDate();
  const targetMonth = baseMonth + cantidadMeses;
  const year = baseYear + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(baseDay, daysInMonth);
  return new Date(year, month, day).toISOString().slice(0, 10);
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

  const upload = async (contratoId: number, file: File, nombre?: string, tipo?: string, descripcion?: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (nombre) formData.append("nombre", nombre);
      if (tipo) formData.append("tipo", tipo);
      if (descripcion) formData.append("descripcion", descripcion);

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

// —— Archivo: actualizar descripcion ——————————————————————————————————————————————

export const useContratoArchivoUpdate = () => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loading, setLoading] = useState(false);

  const updateArchivo = async (
    contratoId: number,
    archivoId: number,
    payload: { descripcion?: string | null },
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/contratos/${contratoId}/archivos/${archivoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify(data?.detail ?? "No se pudo actualizar el archivo", { type: "warning" });
        return false;
      }
      refresh();
      notify("Descripcion actualizada", { type: "info" });
      return true;
    } catch {
      notify("Error al actualizar el archivo", { type: "warning" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { updateArchivo, loading };
};

const splitNombreCompleto = (nombreCompleto?: string | null) => {
  const parts = String(nombreCompleto ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { nombre: "", apellido: "" };
  }

  if (parts.length === 1) {
    return { nombre: parts[0], apellido: "" };
  }

  return {
    nombre: parts.slice(0, -1).join(" "),
    apellido: parts[parts.length - 1],
  };
};

const getTelefonoPrincipal = (telefonos?: unknown) => {
  if (Array.isArray(telefonos)) {
    const first = telefonos.find((value) => String(value ?? "").trim());
    return first ? String(first).trim() : "";
  }

  if (telefonos && typeof telefonos === "object") {
    const indexed = telefonos as Record<string, unknown>;
    const first = indexed["0"];
    return first ? String(first).trim() : "";
  }

  if (typeof telefonos === "string") {
    return telefonos.trim();
  }

  return "";
};

export const useInquilinoDesdeContacto = (propiedadId?: number | null) => {
  const notify = useNotify();
  const { setValue } = useFormContext<ContratoFormValues>();

  const { data: propiedad } = useGetOne<PropiedadContactoRecord>(
    "propiedades",
    { id: propiedadId ?? 0 },
    { enabled: Boolean(propiedadId) },
  );

  const contactoId = resolveNumericId(propiedad?.contacto_id) ?? null;

  const { data: contacto, isLoading } = useGetOne<CRMContactoRecord>(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) },
  );

  const contactoNombre = contacto?.nombre_completo?.trim() || "Sin asignar";

  const completar = useCallback(() => {
    if (!contactoId || !contacto) {
      notify("La propiedad no tiene un contacto asociado", { type: "warning" });
      return;
    }

    const { nombre, apellido } = splitNombreCompleto(contacto.nombre_completo);
    const telefono = getTelefonoPrincipal(contacto.telefonos);

    setValue("inquilino_nombre", nombre, { shouldDirty: true, shouldValidate: true });
    setValue("inquilino_apellido", apellido, { shouldDirty: true, shouldValidate: true });
    setValue("inquilino_email", contacto.email?.trim() || "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("inquilino_telefono", telefono, {
      shouldDirty: true,
      shouldValidate: true,
    });

    notify("Datos del inquilino completados desde el contacto", { type: "info" });
  }, [contacto, contactoId, notify, setValue]);

  return {
    contactoNombre,
    canCompletar: Boolean(contactoId && contacto),
    completar,
    isLoading,
  };
};
