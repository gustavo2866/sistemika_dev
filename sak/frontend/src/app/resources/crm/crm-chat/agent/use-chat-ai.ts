"use client";

import { useCallback, useState } from "react";

import { requestChatAIReply, requestCurrentSolicitud } from "./api";
import type { AIReplyResult } from "./types";

type IAAction = "preview" | "request" | null;

type UseChatAIParams = {
  apiUrl: string;
  oportunidadId?: number | null;
  messageId?: number | null;
  getAuthHeaders: () => HeadersInit;
  onTextReply: (reply: string) => void;
  onError: (message: string) => void;
};

export const useChatAI = ({
  apiUrl,
  oportunidadId,
  messageId,
  getAuthHeaders,
  onTextReply,
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

  const requestReply = useCallback(async () => {
    if (!oportunidadId) return null;
    return requestChatAIReply({
      apiUrl,
      oportunidadId,
      messageId,
      authHeaders: getAuthHeaders(),
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

  const generateReply = useCallback(async () => {
    if (!oportunidadId || iaLoading) return;

    setIaLoading(true);
    setIaAction("preview");
    try {
      const result = await requestReply();

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
    openRequestView,
    closeAnalysis,
  };
};
