"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCreatePath, useGetIdentity, useNotify } from "ra-core";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  MessageCircle,
  Trash2,
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
import { cn } from "@/lib/utils";
import { Confirm } from "@/components/confirm";
import type { CRMMensaje } from "../crm-mensajes/model";
import {
  formatMensajeDate,
  formatMensajeTime,
  getMensajeTimestamp,
  type CRMChatConversation,
} from "./model";
type ChatFilter = "todos" | "no_leidos" | "activas" | "prospect";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getTipoOperacionBadgeClasses = (value: string | null | undefined) => {
  if (!value) return "bg-slate-100 text-slate-600";
  const normalized = value.toLowerCase();
  if (normalized.includes("venta")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("alquiler")) return "bg-sky-100 text-sky-700";
  if (normalized.includes("mantenimiento")) return "bg-amber-100 text-amber-700";
  if (normalized.includes("emprendimiento")) return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-600";
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
  const PAGE_LIMIT = 20;
  const AUTO_FILL_PAGES = 2;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const dedupeById = (items: CRMChatConversation[]) => {
    const map = new Map<string, CRMChatConversation>();
    items.forEach((item) => map.set(String(item.id), item));
    return Array.from(map.values());
  };

  useEffect(() => {
    if (identity?.id) {
      setOwnerValue(String(identity.id));
    }
  }, [identity?.id]);

  const fetchConversations = useCallback(
    async (cursor: string | null, append: boolean, autoFillRemaining = AUTO_FILL_PAGES) => {
      const fetchPage = async (pageCursor: string | null) => {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_LIMIT));
        params.set("canal", "whatsapp");
        if (filter === "prospect") {
          params.set("estado_oportunidad", "0-prospect");
        }
        if (ownerValue) params.set("responsable_id", ownerValue);
        if (pageCursor) params.set("cursor", pageCursor);
        const url = `${API_URL}/crm/mensajes/acciones/conversaciones?${params.toString()}`;
        const response = await fetch(url, { headers: { ...getAuthHeaders() } });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];
        return { rows, next: payload.next_cursor ?? null };
      };

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        if (append) {
          const { rows, next } = await fetchPage(cursor);
          setNextCursor(next);
          setConversations((prev) => dedupeById([...prev, ...rows]));
          return;
        }

        let allRows: CRMChatConversation[] = [];
        let nextCursorValue: string | null = cursor;
        let remaining = autoFillRemaining;
        do {
          const { rows, next } = await fetchPage(nextCursorValue);
          allRows = allRows.concat(rows);
          nextCursorValue = next;
          if (allRows.length >= PAGE_LIMIT) break;
          remaining -= 1;
        } while (nextCursorValue && remaining >= 0);

        const uniqueRows = dedupeById(allRows);
        setNextCursor(nextCursorValue);
        setConversations(uniqueRows);
      } catch (error: any) {
        notify(error?.message ?? "No se pudieron cargar las conversaciones.", { type: "warning" });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, notify, ownerValue]
  );

  useEffect(() => {
    fetchConversations(null, false, AUTO_FILL_PAGES);
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
      : filter === "activas"
        ? conversations.filter((item) => item.oportunidad_activo === true)
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
    const params = new URLSearchParams();
    params.set("returnTo", "/crm/chat");
    navigate(`${path}?${params.toString()}`, { state: { conversation } });
  };

  const handleConfirmDiscard = async () => {
    if (!confirmTargetId) return;
    setConfirmLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(
        `${API_URL}/crm/oportunidades/${confirmTargetId}/descartar`,
        { method: "POST", headers },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setConfirmOpen(false);
      setConfirmTargetId(null);
      fetchConversations(null, false, AUTO_FILL_PAGES);
    } catch (error: any) {
      notify(error?.message ?? "No se pudo descartar la oportunidad.", { type: "warning" });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCreateMensaje = () => {
    const path = createPath({ resource: "crm/mensajes", type: "create" });
    const params = new URLSearchParams();
    params.set("returnTo", "/crm/chat");
    navigate(`${path}?${params.toString()}`);
  };

  return (
    <div className="mr-auto flex w-full max-w-xl flex-col gap-3 bg-[#f6f2e8] px-2 pb-24 pt-3 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Chats</h1>
        <div className="flex items-center gap-2">
          <ResponsableSelector
            includeTodos={false}
            value={ownerValue}
            onValueChange={setOwnerValue}
            triggerClassName="h-7 min-w-[120px] rounded-full border border-white/80 bg-white/90 px-2 py-0 text-[11px] shadow-sm sm:h-9 sm:min-w-[160px] sm:text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full bg-emerald-500 text-white shadow-sm sm:h-9 sm:w-9"
            onClick={handleCreateMensaje}
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-2 py-1.5 shadow-sm">
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
          className={`rounded-full px-2 py-1 text-[11px] sm:px-4 sm:py-1.5 sm:text-sm ${
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
          className={`rounded-full px-2 py-1 text-[11px] sm:px-4 sm:py-1.5 sm:text-sm ${
            filter === "no_leidos"
              ? "bg-emerald-100 text-emerald-800"
              : "border border-slate-200/80 bg-white/80 text-slate-600"
          }`}
        >
          No leidos {unreadTotal ? unreadTotal : ""}
        </button>
        <button
          type="button"
          onClick={() => setFilter("activas")}
          className={`rounded-full px-2 py-1 text-[11px] sm:px-4 sm:py-1.5 sm:text-sm ${
            filter === "activas"
              ? "bg-emerald-100 text-emerald-800"
              : "border border-slate-200/80 bg-white/80 text-slate-600"
          }`}
        >
          Activas
        </button>
        <button
          type="button"
          onClick={() => setFilter("prospect")}
          className={`rounded-full px-2 py-1 text-[11px] sm:px-4 sm:py-1.5 sm:text-sm ${
            filter === "prospect"
              ? "bg-emerald-100 text-emerald-800"
              : "border border-slate-200/80 bg-white/80 text-slate-600"
          }`}
        >
          Prospect
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
                const oportunidadId =
                  conversation.oportunidad_id ??
                  mensaje?.oportunidad_id ??
                  mensaje?.oportunidad?.id ??
                  null;
                const oportunidadTitle =
                  conversation.oportunidad_titulo ??
                  mensaje?.oportunidad?.descripcion_estado ??
                  mensaje?.oportunidad?.descripcion ??
                  mensaje?.oportunidad?.nombre ??
                  null;
                const oportunidadEstado =
                  conversation.oportunidad_estado ??
                  mensaje?.oportunidad?.estado ??
                  null;
                const tipoOperacionLabel =
                  conversation.oportunidad_tipo_operacion_nombre ??
                  conversation.oportunidad_tipo_operacion_codigo ??
                  (mensaje?.oportunidad as any)?.tipo_operacion?.nombre ??
                  (mensaje?.oportunidad as any)?.tipo_operacion?.codigo ??
                  null;
                const oportunidadActiva =
                  conversation.oportunidad_activo ??
                  true;
                const isOportunidadInactiva = oportunidadActiva === false;
                const isProspect = conversation.oportunidad_estado === "0-prospect";
                const oportunidadMeta = oportunidadEstado
                  ? `${oportunidadId} - ${oportunidadEstado}`
                  : `${oportunidadId}`;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleOpen(conversation)}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3",
                      isOportunidadInactiva &&
                        "bg-slate-100/80 text-slate-500 hover:bg-slate-200/80"
                    )}
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
                      {oportunidadId ? (
                        <div
                          className={cn(
                            "flex items-center gap-1 text-[9px] text-slate-400",
                            isOportunidadInactiva && "text-rose-600"
                          )}
                        >
                          <span className="truncate">
                            {oportunidadTitle ?? "Sin titulo"} ({oportunidadMeta})
                          </span>
                          {tipoOperacionLabel ? (
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide",
                                getTipoOperacionBadgeClasses(tipoOperacionLabel)
                              )}
                            >
                              {tipoOperacionLabel}
                            </span>
                          ) : null}
                          {isProspect ? (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (typeof oportunidadId === "number") {
                                  setConfirmTargetId(oportunidadId);
                                  setConfirmOpen(true);
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.stopPropagation();
                                  event.preventDefault();
                                  if (typeof oportunidadId === "number") {
                                    setConfirmTargetId(oportunidadId);
                                    setConfirmOpen(true);
                                  }
                                }
                              }}
                              className="ml-auto inline-flex cursor-pointer text-rose-500 hover:text-rose-600"
                              aria-label="Descartar oportunidad"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
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
      <Confirm
        isOpen={confirmOpen}
        loading={confirmLoading}
        title="Descartar oportunidad"
        content="Esto eliminara la oportunidad y todos los mensajes asociados. ¿Continuar?"
        confirm="Descartar"
        confirmColor="warning"
        onConfirm={handleConfirmDiscard}
        onClose={() => {
          if (confirmLoading) return;
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />
    </div>
  );
};


