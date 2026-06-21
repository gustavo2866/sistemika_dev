"use client";

import type { AIReplyResult, MaterialFamily } from "./types";

const legacyAgentRemoved = (): never => {
  throw new Error("El agente legacy fue retirado. Usar el flujo v3 desde WhatsApp/channel.");
};

type RequestChatAIReplyParams = {
  apiUrl: string;
  oportunidadId: number;
  messageId?: number | null;
  authHeaders: HeadersInit;
};

export const requestChatAIReply = async (
  _params: RequestChatAIReplyParams,
): Promise<AIReplyResult> => {
  return legacyAgentRemoved();
};

type RequestCurrentSolicitudParams = {
  apiUrl: string;
  oportunidadId: number;
  authHeaders: HeadersInit;
};

export const requestCurrentSolicitud = async (
  _params: RequestCurrentSolicitudParams,
): Promise<AIReplyResult> => {
  return legacyAgentRemoved();
};

type RequestMaterialFamilyParams = {
  apiUrl: string;
  familyKey: string;
  authHeaders: HeadersInit;
};

export const requestMaterialFamily = async (
  _params: RequestMaterialFamilyParams,
): Promise<MaterialFamily> => {
  return legacyAgentRemoved();
};

type SaveMaterialFamilyParams = {
  apiUrl: string;
  familyKey: string;
  authHeaders: HeadersInit;
  family: MaterialFamily;
};

export const saveMaterialFamily = async (
  _params: SaveMaterialFamilyParams,
): Promise<{ family: MaterialFamily; created: boolean }> => {
  return legacyAgentRemoved();
};
