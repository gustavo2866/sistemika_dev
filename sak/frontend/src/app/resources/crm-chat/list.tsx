"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCreatePath, useGetIdentity, useNotify } from "ra-core";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  MessageCircle,
  Phone,
  Users,
  MoreHorizontal,
  Plus,
  User,
  Search,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ResponsableSelector } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CRMMensaje } from "../crm-mensajes/model";
import {
  formatMensajeDate,
  formatMensajeTime,
  getMensajeTimestamp,
  type CRMChatConversation,
} from "./model";
type ChatFilter = "todos" | "no_leidos";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const CRMChatList = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const { data: identity } = useGetIdentity();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<CRMChatConversation[]>([]);
  const [filter, setFilter] = useState<ChatFilter>("todos");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [ownerValue, setOwnerValue] = useState("");

  useEffect(() => {
    if (identity?.id) {
      setOwnerValue(String(identity.id));
    }
  }, [identity?.id]);

  const fetchConversations = useCallback(
    async (cursor: string | null, append: boolean) => {
      const params = new URLSearchParams();
      params.set("limit", "30");
      params.set("canal", "whatsapp");
      if (ownerValue) params.set("responsable_id", ownerValue);
      if (cursor) params.set("cursor", cursor);
      const url = `${API_URL}/crm/mensajes/acciones/conversaciones?${params.toString()}`;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(url, { headers: { ...getAuthHeaders() } });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setNextCursor(payload.next_cursor ?? null);
        setConversations((prev) => (append ? [...prev, ...rows] : rows));
      } catch (error: any) {
        notify(error?.message ?? "No se pudieron cargar las conversaciones.", { type: "warning" });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [notify, ownerValue]
  );

  useEffect(() => {
    fetchConversations(null, false);
  }, [fetchConversations]);

  useEffect(() => {
    const handleScroll = () => {
      if (!nextCursor || loadingMore || loading) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        fetchConversations(nextCursor, true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchConversations, loading, loadingMore, nextCursor]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = filter === "no_leidos"
      ? conversations.filter((item) => (item.unread_count ?? 0) > 0)
      : conversations;
    if (!needle) return base;
    return base.filter((item) => {
      const name = item.contacto_nombre?.toLowerCase() ?? "";
      const preview = item.ultimo_mensaje?.contenido?.toLowerCase() ?? "";
      return name.includes(needle) || preview.includes(needle);
    });
  }, [conversations, search, filter]);

  const unreadTotal = useMemo(
    () => conversations.reduce((acc, item) => acc + (item.unread_count ?? 0), 0),
    [conversations]
  );

  const handleOpen = (conversation: CRMChatConversation) => {
    const path = createPath({ resource: "crm/chat", type: "show", id: conversation.id });
    navigate(path, { state: { conversation } });
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 bg-[#f6f2e8] px-4 pb-24 pt-3 sm:px-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-white/80 text-slate-600 shadow-sm sm:h-9 sm:w-9"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <ResponsableSelector
            includeTodos={false}
            value={ownerValue}
            onValueChange={setOwnerValue}
            hideLabel
            triggerClassName="h-8 w-8 rounded-full border border-white/80 bg-white/90 px-0 py-0 shadow-sm [&_[data-slot=select-value]]:w-full [&_[data-slot=select-value]]:justify-center [&_[data-slot=select-value]_span]:hidden sm:h-9 sm:w-9"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-emerald-500 text-white shadow-sm sm:h-9 sm:w-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Chats</h1>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-1.5 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Preguntar a Meta AI o buscar"
          className="h-6 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          className={`rounded-full px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm ${
            filter === "todos"
              ? "bg-emerald-100 text-emerald-800"
              : "border border-slate-200/80 bg-white/80 text-slate-600"
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setFilter("no_leidos")}
          className={`rounded-full px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm ${
            filter === "no_leidos"
              ? "bg-emerald-100 text-emerald-800"
              : "border border-slate-200/80 bg-white/80 text-slate-600"
          }`}
        >
          No leidos {unreadTotal ? unreadTotal : ""}
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 sm:px-4 sm:py-1.5 sm:text-sm"
        >
          Favoritos
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 sm:px-4 sm:py-1.5 sm:text-sm"
        >
          Grupos
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm">
        {loading ? (
          <div className="px-4 py-6 text-xs text-slate-500">Cargando conversaciones...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-500">Sin conversaciones.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered
              .sort((a, b) => {
                const aTime = a.ultimo_mensaje ? getMensajeTimestamp(a.ultimo_mensaje) : 0;
                const bTime = b.ultimo_mensaje ? getMensajeTimestamp(b.ultimo_mensaje) : 0;
                const aUnread = a.unread_count ?? 0;
                const bUnread = b.unread_count ?? 0;
                if (aUnread > 0 && bUnread === 0) return -1;
                if (bUnread > 0 && aUnread === 0) return 1;
                return bTime - aTime;
              })
              .map((conversation) => {
                const mensaje = conversation.ultimo_mensaje as CRMMensaje | null;
                const displayName = conversation.contacto_nombre ?? "Sin contacto";
                const preview = mensaje?.contenido?.trim() ?? "Sin mensaje";
                const timeLabel = mensaje ? formatMensajeTime(mensaje) : "";
                const dateLabel = mensaje ? formatMensajeDate(mensaje) : "";
                const isOutgoing = mensaje?.tipo === "salida";
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleOpen(conversation)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <Avatar className="size-9 border border-slate-200">
                      <AvatarFallback className="bg-slate-100 text-[11px] font-semibold text-slate-600">
                        {displayName
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                        <span className="text-[10px] text-slate-400">{timeLabel || dateLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {isOutgoing ? (
                          <ArrowUpRight className="h-3 w-3 text-slate-400" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-slate-400" />
                        )}
                        <span className="truncate">{preview}</span>
                      </div>
                    </div>
                    {conversation.unread_count ? (
                      <div className="ml-auto flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-semibold text-white">
                        {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                      </div>
                    ) : null}
                  </button>
                );
              })}
          </div>
        )}
      </div>
      <div className="sticky bottom-3 z-10">
        <div className="mx-auto flex w-full max-w-[320px] items-center justify-between rounded-[24px] border border-slate-200/70 bg-white/95 px-3 py-1.5 shadow-[0_10px_20px_rgba(15,23,42,0.12)]">
          <button className="flex flex-col items-center gap-0.5 text-[9px] text-slate-500">
            <Bell className="h-3.5 w-3.5 text-slate-700" />
            Novedades
          </button>
          <button className="flex flex-col items-center gap-0.5 text-[9px] text-slate-500">
            <Phone className="h-3.5 w-3.5 text-slate-700" />
            Llamadas
          </button>
          <button className="flex flex-col items-center gap-0.5 text-[9px] text-slate-500">
            <Users className="h-3.5 w-3.5 text-slate-700" />
            Comunidades
          </button>
          <button className="flex flex-col items-center gap-0.5 text-[9px] text-emerald-600">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            Chats
          </button>
          <button className="flex flex-col items-center gap-0.5 text-[9px] text-slate-500">
            <User className="h-3.5 w-3.5 text-slate-700" />
            Tu
          </button>
        </div>
      </div>
    </div>
  );
};
