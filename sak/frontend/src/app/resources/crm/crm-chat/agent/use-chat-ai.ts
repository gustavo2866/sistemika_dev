"use client";

import { useCallback, useState } from "react";

import {
  requestChatAIReply,
  requestCurrentSolicitud,
  type AIDeliveryMode,
} from "./api";
import type { AIReplyResult } from "./types";

type IAAction = "preview" | "auto" | "request" | null;

type UseChatAIParams = {
  apiUrl: string;
  oportunidadId?: number | null;
  messageId?: number | null;
  getAuthHeaders: () => HeadersInit;
  onTextReply: (reply: string) => void;
  onAutoReplySent: (result: AIReplyResult) => void;
  onError: (message: string) => void;
};

export const useChatAI = ({
  apiUrl,
  oportunidadId,
  messageId,
  getAuthHeaders,
  onTextReply,
  onAutoReplySent,
  onError,
}: UseChatAIParams) => {
  const [iaLoading, setIaLoading] = useState(false);
  const [iaAction, setIaAction] = useState<IAAction>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIReplyResult | null>(null);

  const closeAnalysis = useCallback((open: boolean) => {
    setAnalysisOpen(open);
    if (!open) {
      setAnalysisResult(null);
    }
  }, []);

  const requestReply = useCallback(async ({
    forceReprocess = false,
    deliveryMode,
  }: {
    forceReprocess?: boolean;
    deliveryMode: AIDeliveryMode;
  }) => {
    if (!oportunidadId) return null;
    return requestChatAIReply({
      apiUrl,
      oportunidadId,
      messageId,
      authHeaders: getAuthHeaders(),
      forceReprocess,
      deliveryMode,
    });
  }, [apiUrl, getAuthHeaders, messageId, oportunidadId]);

  const extractReplyText = useCallback((result: AIReplyResult | null) => {
    return String(
      result?.respuesta ??
        (result as { reply?: string | null } | null)?.reply ??
        (result as { mensaje?: string | null } | null)?.mensaje ??
        (result as { texto?: string | null } | null)?.texto ??
        "",
    ).trim();
  }, []);

  const generateReply = useCallback(async (options?: { forceReprocess?: boolean }) => {
    if (!oportunidadId || iaLoading) return;

    setIaLoading(true);
    setIaAction("preview");
    try {
      const result = await requestReply({
        forceReprocess: Boolean(options?.forceReprocess),
        deliveryMode: "preview_only",
      });

      if (result?.type === "material_request") {
        setAnalysisResult(result);
        setAnalysisOpen(true);
        return;
      }

      const suggestedReply = extractReplyText(result);
      if (!suggestedReply) {
        throw new Error("La IA no devolvio una respuesta utilizable.");
      }

      onTextReply(suggestedReply);
    } catch (error: any) {
      onError(error?.message ?? "No se pudo generar la respuesta IA.");
    } finally {
      setIaLoading(false);
      setIaAction(null);
    }
  }, [extractReplyText, iaLoading, onError, onTextReply, oportunidadId, requestReply]);

  const autoReply = useCallback(async (options?: { forceReprocess?: boolean }) => {
    if (!oportunidadId || iaLoading) return;

    setIaLoading(true);
    setIaAction("auto");
    try {
      const result = await requestReply({
        forceReprocess: Boolean(options?.forceReprocess),
        deliveryMode: "auto_send",
      });

      if (result?.delivery?.sent) {
        onAutoReplySent(result);
        return;
      }

      const reason = String(result?.reason ?? "").trim();
      const deliveryError = String(result?.delivery?.error_message ?? "").trim();
      const deliveryStatus = String(result?.delivery?.status ?? "").trim();
      const fallbackReply = extractReplyText(result);

      if (reason) {
        throw new Error(reason);
      }
      if (deliveryError) {
        throw new Error(deliveryError);
      }
      if (deliveryStatus === "deferred") {
        throw new Error("El turno quedo diferido segun la modalidad actual.");
      }
      if (deliveryStatus === "skipped") {
        throw new Error("El agente no encontro un proceso aplicable para este mensaje.");
      }
      if (deliveryStatus === "no_reply") {
        throw new Error("La IA no devolvio un texto para enviar.");
      }
      if (fallbackReply) {
        throw new Error("La IA genero una respuesta, pero no se pudo enviar.");
      }

      throw new Error("La IA no pudo auto-responder el mensaje.");
    } catch (error: any) {
      onError(error?.message ?? "No se pudo auto-responder el mensaje.");
    } finally {
      setIaLoading(false);
      setIaAction(null);
    }
  }, [extractReplyText, iaLoading, onAutoReplySent, onError, oportunidadId, requestReply]);

  const openRequestView = useCallback(async () => {
    if (!oportunidadId || iaLoading) return;

    setIaLoading(true);
    setIaAction("request");
    try {
      const result = await requestCurrentSolicitud({
        apiUrl,
        oportunidadId,
        authHeaders: getAuthHeaders(),
      });
      setAnalysisResult(result);
      setAnalysisOpen(true);
    } catch (error: any) {
      onError(error?.message ?? "No se pudo cargar la solicitud actual.");
    } finally {
      setIaLoading(false);
      setIaAction(null);
    }
  }, [apiUrl, getAuthHeaders, iaLoading, onError, oportunidadId]);

  return {
    iaLoading,
    iaAction,
    analysisOpen,
    analysisResult,
    generateReply,
    autoReply,
    openRequestView,
    closeAnalysis,
  };
};
