"use client";

import type { AIReplyResult, MaterialFamily } from "./types";

export type AIDeliveryMode = "preview_only" | "auto_send";

type RequestChatAIReplyParams = {
  apiUrl: string;
  oportunidadId: number;
  messageId?: number | null;
  authHeaders: HeadersInit;
  forceReprocess?: boolean;
  deliveryMode?: AIDeliveryMode;
};

export const requestChatAIReply = async ({
  apiUrl,
  oportunidadId,
  messageId,
  authHeaders,
  forceReprocess = false,
  deliveryMode = "preview_only",
}: RequestChatAIReplyParams): Promise<AIReplyResult> => {
  const response = await fetch(
    `${apiUrl}/crm/mensajes/acciones/chat/${oportunidadId}/ia-respuesta-v2`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        message_id: messageId ?? undefined,
        force_reprocess: forceReprocess || undefined,
        delivery_mode: deliveryMode !== "preview_only" ? deliveryMode : undefined,
      }),
    },
  );

  if (!response.ok) {
    let errorMessage = `Error al generar respuesta IA (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.detail || errorMessage;
    } catch {
      // ignore invalid error payloads
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as AIReplyResult;
};

type RequestCurrentSolicitudParams = {
  apiUrl: string;
  oportunidadId: number;
  authHeaders: HeadersInit;
};

export const requestCurrentSolicitud = async ({
  apiUrl,
  oportunidadId,
  authHeaders,
}: RequestCurrentSolicitudParams): Promise<AIReplyResult> => {
  const response = await fetch(
    `${apiUrl}/crm/mensajes/acciones/chat/${oportunidadId}/solicitud-v2`,
    {
      method: "GET",
      headers: { ...authHeaders },
    },
  );

  if (!response.ok) {
    let errorMessage = `Error al cargar la solicitud (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.detail || errorMessage;
    } catch {
      // ignore invalid error payloads
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as AIReplyResult;
};

type RequestMaterialFamilyParams = {
  apiUrl: string;
  familyKey: string;
  authHeaders: HeadersInit;
};

export const requestMaterialFamily = async ({
  apiUrl,
  familyKey,
  authHeaders,
}: RequestMaterialFamilyParams): Promise<MaterialFamily> => {
  const response = await fetch(
    `${apiUrl}/crm/mensajes/acciones/chat/ia-familias/${encodeURIComponent(familyKey)}`,
    {
      method: "GET",
      headers: { ...authHeaders },
    },
  );

  if (!response.ok) {
    let errorMessage = `Error al cargar familia (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.detail || errorMessage;
    } catch {
      // ignore invalid error payloads
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as { family?: MaterialFamily };
  if (!payload.family) {
    throw new Error("La API no devolvio una familia valida");
  }
  return payload.family;
};

type SaveMaterialFamilyParams = {
  apiUrl: string;
  familyKey: string;
  authHeaders: HeadersInit;
  family: MaterialFamily;
};

export const saveMaterialFamily = async ({
  apiUrl,
  familyKey,
  authHeaders,
  family,
}: SaveMaterialFamilyParams): Promise<{ family: MaterialFamily; created: boolean }> => {
  const response = await fetch(
    `${apiUrl}/crm/mensajes/acciones/chat/ia-familias/${encodeURIComponent(familyKey)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(family),
    },
  );

  if (!response.ok) {
    let errorMessage = `Error al guardar familia (HTTP ${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.detail || errorMessage;
    } catch {
      // ignore invalid error payloads
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as {
    family?: MaterialFamily;
    created?: boolean;
  };
  if (!payload.family) {
    throw new Error("La API no devolvio la familia guardada");
  }

  return {
    family: payload.family,
    created: Boolean(payload.created),
  };
};
