"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { useCreatePath, useNotify } from "ra-core";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ResourceBackButton } from "@/components/resource-back-button";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/dataProvider";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
};

type AgentOutbound = {
  id?: string | number | null;
  text?: string | null;
  status?: string | null;
};

type AgentResultMetadata = {
  parte_diario_id?: number | string | null;
  result?: {
    parte_diario_id?: number | string | null;
  } | null;
};

type AgentResult = {
  ready: boolean;
  outbounds?: AgentOutbound[];
  metadata?: AgentResultMetadata;
};

type ChatSendOptions = {
  fromName?: string;
  fromPhone?: string;
};

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 30_000;

const buildAuthHeaders = () => {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("auth_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const resetAgentChat = async (signal: AbortSignal) => {
  const response = await fetch(`${apiUrl}/api/agente/v3/inbox/reset?queue=smoke`, {
    method: "POST",
    headers: buildAuthHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`No se pudo reiniciar el chat (${response.status})`);
  }
};

const sendAgentMessage = async (text: string, signal: AbortSignal, options: ChatSendOptions = {}) => {
  const response = await fetch(`${apiUrl}/api/agente/v3/chat/send`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      texto: text,
      ...(options.fromPhone ? { from_phone: options.fromPhone } : {}),
      ...(options.fromName ? { from_name: options.fromName } : {}),
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`No se pudo enviar el mensaje (${response.status})`);
  }
  return (await response.json()) as { meta_message_id: string; from_phone?: string };
};

const fetchAgentResult = async (
  metaMessageId: string,
  signal: AbortSignal,
  options: ChatSendOptions = {},
) => {
  const params = new URLSearchParams();
  if (options.fromPhone) params.set("from_phone", options.fromPhone);
  const query = params.toString();
  const response = await fetch(
    `${apiUrl}/api/agente/v3/chat/result/${encodeURIComponent(metaMessageId)}${query ? `?${query}` : ""}`,
    {
      headers: buildAuthHeaders(),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`No se pudo leer la respuesta (${response.status})`);
  }
  return (await response.json()) as AgentResult;
};

const pollAgentResult = async (
  metaMessageId: string,
  signal: AbortSignal,
  options: ChatSendOptions = {},
) => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (!signal.aborted && Date.now() < deadline) {
    const result = await fetchAgentResult(metaMessageId, signal, options);
    if (result.ready) return result;
    await sleep(POLL_INTERVAL_MS);
  }
  return { ready: false, outbounds: [] } satisfies AgentResult;
};

const resolveParteDiarioId = (metadata?: AgentResultMetadata) =>
  metadata?.parte_diario_id ?? metadata?.result?.parte_diario_id ?? null;

export const AgentChatList = () => {
  const notify = useNotify();
  const createPath = useCreatePath();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source")?.trim() ?? "";
  const initialMessage = searchParams.get("message")?.trim() ?? "";
  const fromPhone = searchParams.get("from_phone")?.trim() ?? "";
  const fromName = searchParams.get("from_name")?.trim() ?? "";
  const returnTo = searchParams.get("returnTo")?.trim() ?? "";
  const contactLabel = fromName || (fromPhone ? fromPhone : "Contacto de prueba");
  const requiresSourcePhone = source === "parte-diario";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [savedParteDiarioId, setSavedParteDiarioId] = useState<number | string | null>(null);
  const [resetReady, setResetReady] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  const appendMessages = useCallback((items: ChatMessage[]) => {
    setMessages((current) => [...current, ...items]);
  }, []);

  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    if (requiresSourcePhone && !fromPhone) {
      notify("El contacto no tiene telefono para simular WhatsApp.", { type: "warning" });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (textOverride === undefined) setDraft("");
    setSending(true);
    appendMessages([{ id: `user-${Date.now()}`, role: "user", text }]);

    try {
      const sent = await sendAgentMessage(text, controller.signal, { fromName, fromPhone });
      const result = await pollAgentResult(sent.meta_message_id, controller.signal, {
        fromPhone: sent.from_phone || fromPhone,
      });
      const outbounds = result.outbounds ?? [];
      const parteDiarioId = resolveParteDiarioId(result.metadata);
      if (parteDiarioId) setSavedParteDiarioId(parteDiarioId);
      if (!outbounds.length) {
        appendMessages([
          {
            id: `system-${sent.meta_message_id}`,
            role: "system",
            text: "El webhook guardo el mensaje, pero aun no hay resultado del agente.",
          },
        ]);
        return;
      }
      appendMessages(
        outbounds.map((item, index) => ({
          id: `agent-${item.id ?? sent.meta_message_id}-${index}`,
          role: "agent",
          text: item.text || "(sin texto)",
        })),
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        notify(error instanceof Error ? error.message : "No se pudo completar el chat.", {
          type: "warning",
        });
      }
    } finally {
      if (!controller.signal.aborted) setSending(false);
      requestAnimationFrame(() => {
        draftRef.current?.focus();
      });
    }
  }, [appendMessages, draft, fromName, fromPhone, notify, requiresSourcePhone, sending]);

  const backToParteDiario = savedParteDiarioId
    ? (() => {
        const path = createPath({ resource: "parte-diario", type: "edit", id: savedParteDiarioId });
        if (!returnTo) return path;
        const params = new URLSearchParams({ returnTo });
        return `${path}?${params.toString()}`;
      })()
    : undefined;

  useEffect(
    () => {
      const controller = new AbortController();
      setResetReady(false);
      resetAgentChat(controller.signal)
        .then(() => {
          if (!controller.signal.aborted) setResetReady(true);
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            notify(error instanceof Error ? error.message : "No se pudo reiniciar el chat.", {
              type: "warning",
            });
          }
        });
      return () => {
        controller.abort();
        abortRef.current?.abort();
      };
    },
    [notify],
  );

  useEffect(() => {
    if (!resetReady || !initialMessage || autoSentRef.current) return;
    autoSentRef.current = true;
    void handleSend(initialMessage);
  }, [handleSend, initialMessage, resetReady]);

  return (
    <div className="flex min-h-[calc(100dvh-96px)] w-full items-start justify-center bg-slate-50 px-3 py-4">
      <section className="flex h-[calc(100dvh-128px)] max-h-[720px] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-[#efe7d7] shadow-sm">
        <header className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2">
          <ResourceBackButton
            fallbackTo="/parte-diario"
            returnTo={backToParteDiario}
            className="h-8 px-2 text-xs"
            iconClassName="h-3.5 w-3.5"
          />
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Bot className="size-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-900">Chat agente</h1>
            <p className="truncate text-[10px] text-slate-500">{contactLabel}</p>
          </div>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Sin mensajes.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-lg px-3 py-2 text-xs leading-relaxed shadow-sm",
                        isUser
                          ? "bg-[#d9fdd3] text-slate-900"
                          : message.role === "system"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-white text-slate-800",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    </div>
                  </div>
                );
              })}
              {sending ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
                    <Loader2 className="size-3 animate-spin" />
                    Agente escribiendo...
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200/70 bg-[#f7f3eb] px-3 py-2">
          <div className="flex items-end gap-2">
            <Textarea
              ref={draftRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder="Mensaje"
              className="min-h-9 flex-1 resize-none rounded-full border-slate-200 bg-white px-4 py-2 text-sm shadow-sm"
              disabled={sending}
            />
            <Button
              type="button"
              size="icon"
              className="size-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!draft.trim() || sending}
              onClick={() => void handleSend()}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default AgentChatList;
