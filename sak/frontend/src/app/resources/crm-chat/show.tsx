"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Copy,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Send,
} from "lucide-react";
import { useNotify, useGetIdentity } from "ra-core";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { CRMMensaje } from "../crm-mensajes/model";
import {
  formatMensajeTime,
  getConversationDisplayName,
  getMensajeTimestamp,
  type CRMChatConversation,
} from "./model";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_MS = 5000;

const getAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

type ConversationTarget = {
  contacto_id?: number;
  oportunidad_id?: number;
  contacto_referencia?: string;
};

const parseConversationId = (rawId?: string | null): ConversationTarget => {
  if (!rawId) return {};
  if (rawId.startsWith("op-")) {
    const id = Number(rawId.slice(3));
    return Number.isFinite(id) ? { oportunidad_id: id } : {};
  }
  if (rawId.startsWith("co-")) {
    const id = Number(rawId.slice(3));
    return Number.isFinite(id) ? { contacto_id: id } : {};
  }
  if (rawId.startsWith("ref-")) {
    return { contacto_referencia: decodeURIComponent(rawId.slice(4)) };
  }
  return {};
};

const buildCursorUrl = (
  target: ConversationTarget,
  cursor?: string | null,
  limit = 40,
) => {
  const params = new URLSearchParams();
  if (target.oportunidad_id) params.set("oportunidad_id", String(target.oportunidad_id));
  if (!target.oportunidad_id && target.contacto_id) params.set("contacto_id", String(target.contacto_id));
  if (!target.oportunidad_id && !target.contacto_id && target.contacto_referencia) {
    params.set("contacto_referencia", target.contacto_referencia);
  }
  params.set("limit", String(limit));
  params.set("canal", "whatsapp");
  if (cursor) params.set("cursor", cursor);
  return `${API_URL}/crm/mensajes/acciones/cursor?${params.toString()}`;
};

const mergeMessages = (current: CRMMensaje[], incoming: CRMMensaje[]) => {
  const map = new Map<number, CRMMensaje>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => getMensajeTimestamp(a) - getMensajeTimestamp(b));
};

export const CRMChatShow = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const { data: identity } = useGetIdentity();
  const conversationState = (location.state as { conversation?: CRMChatConversation } | null)?.conversation;

  const target = useMemo(() => parseConversationId(id), [id]);
  const [messages, setMessages] = useState<CRMMensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false);
  const markReadRef = useRef(false);

  useEffect(() => {
    markReadRef.current = false;
  }, [id]);

  const displayName = useMemo(() => {
    if (conversationState?.contacto_nombre) return conversationState.contacto_nombre;
    if (messages.length) return getConversationDisplayName(messages[messages.length - 1]);
    return "Conversacion";
  }, [conversationState?.contacto_nombre, messages]);

  const canSend = useMemo(() => {
    if (target.oportunidad_id) return true;
    return messages.some((msg) => Boolean(msg.oportunidad_id));
  }, [messages, target.oportunidad_id]);

  const resolveOportunidadId = useMemo(() => {
    if (target.oportunidad_id) return target.oportunidad_id;
    const found = [...messages].reverse().find((msg) => msg.oportunidad_id);
    return found?.oportunidad_id ?? null;
  }, [messages, target.oportunidad_id]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildCursorUrl(target, null, 40);
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      const normalized = [...data].sort((a, b) => getMensajeTimestamp(a) - getMensajeTimestamp(b));
      setMessages(normalized);
      setNextCursor(payload.next_cursor ?? null);
      initialLoadedRef.current = true;
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    } catch (error: any) {
      notify(error?.message ?? "No se pudieron cargar los mensajes.", { type: "warning" });
    } finally {
      setLoading(false);
    }
  }, [notify, target]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = buildCursorUrl(target, nextCursor, 40);
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      const normalized = [...data].sort((a, b) => getMensajeTimestamp(a) - getMensajeTimestamp(b));
      setMessages((prev) => mergeMessages(normalized, prev));
      setNextCursor(payload.next_cursor ?? null);
    } catch (error: any) {
      notify(error?.message ?? "No se pudieron cargar mensajes anteriores.", { type: "warning" });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, notify, target]);

  const refreshLatest = useCallback(async () => {
    if (!initialLoadedRef.current) return;
    try {
      const url = buildCursorUrl(target, null, 20);
      const response = await fetch(url, { headers: { ...getAuthHeaders() } });
      if (!response.ok) return;
      const payload = await response.json();
      const data = Array.isArray(payload.data) ? payload.data : [];
      setMessages((prev) => mergeMessages(prev, data));
    } catch {
      // ignore polling errors
    }
  }, [target]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!initialLoadedRef.current || markReadRef.current) return;
    const markRead = async () => {
      try {
        await fetch(`${API_URL}/crm/mensajes/acciones/marcar-leidos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            oportunidad_id: target.oportunidad_id,
            contacto_id: target.contacto_id,
            contacto_referencia: target.contacto_referencia,
          }),
        });
      } catch {
        // ignore mark read errors
      }
    };
    markRead();
    markReadRef.current = true;
  }, [target]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshLatest();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshLatest]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollTop < 60) {
      loadMore();
    }
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!resolveOportunidadId) {
      notify("No se puede enviar sin oportunidad asociada.", { type: "warning" });
      return;
    }
    try {
      const response = await fetch(`${API_URL}/crm/mensajes/acciones/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          contenido: trimmed,
          oportunidad_id: resolveOportunidadId,
          responsable_id: identity?.id,
          canal: "whatsapp",
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setDraft("");
      refreshLatest();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo enviar el mensaje.", { type: "warning" });
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-xl flex-col bg-[#f6f2e8]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="size-9 border border-slate-200">
          <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
            {displayName
              .split(/\s+/)
              .filter(Boolean)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="text-[10px] text-slate-500">WhatsApp</p>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 pb-28 pt-4" onScroll={handleScroll}>
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Cargando mensajes...</div>
        ) : messages.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">Sin mensajes.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {loadingMore ? (
              <div className="text-center text-[10px] text-slate-400">Cargando anteriores...</div>
            ) : null}
            {messages.map((mensaje) => {
              const isOutgoing = mensaje.tipo === "salida";
              const timeLabel = formatMensajeTime(mensaje);
              return (
                <div
                  key={mensaje.id}
                  className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                      isOutgoing ? "bg-[#e3a78c] text-white" : "bg-white text-slate-700"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{mensaje.contenido ?? ""}</p>
                    <div className="mt-1 text-[10px] opacity-70">{timeLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-[#f6f2e8] pb-2 pt-1.5">
        <div className="mx-3 rounded-2xl border border-slate-200/70 bg-white/90 px-2 py-1 shadow-[0_12px_22px_rgba(15,23,42,0.12)] sm:px-3 sm:py-1.5">
          <div className="flex items-center gap-1.5 pb-1 text-[9px] text-slate-400 sm:pb-1.5 sm:text-[10px]">
            <Button variant="ghost" size="icon" className="h-5.5 w-5.5 text-slate-400 sm:h-6 sm:w-6">
              <Mic className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5.5 w-5.5 text-slate-400 sm:h-6 sm:w-6">
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5.5 w-5.5 text-slate-400 sm:h-6 sm:w-6">
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full border border-slate-200 text-slate-500 sm:h-8 sm:w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 text-xs">
                <DropdownMenuItem>Adjuntar archivo</DropdownMenuItem>
                <DropdownMenuItem>Enviar imagen</DropdownMenuItem>
                <DropdownMenuItem>Nota interna</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={1}
              placeholder={canSend ? "Responder..." : "Sin oportunidad asociada"}
              className="min-h-[34px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] shadow-sm sm:min-h-[38px] sm:text-xs"
              disabled={!canSend}
            />
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 rounded-full bg-[#e3a78c] text-white shadow-sm hover:bg-[#d99677] sm:h-9 sm:w-9"
              onClick={handleSend}
              disabled={!canSend || !draft.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-6 mt-1.5 rounded-[24px] border border-slate-200/80 bg-white/95 px-3 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.12)] sm:mt-2 sm:px-3.5 sm:py-1.5">
          <div className="flex items-center justify-between text-slate-700">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-9 sm:w-9">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-9 sm:w-9">
              <span className="text-sm font-semibold sm:text-base">›</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-9 sm:w-9">
              <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-9 sm:w-9">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-9 sm:w-9">
              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
