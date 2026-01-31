"use client";

import { useMemo } from "react";
import { useGetOne } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import {
  appendFilterParam,
  buildOportunidadFilter,
} from "@/lib/oportunidad-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Calendar, House, MessageCircle } from "lucide-react";

export type CrmContextHeaderProps = {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  returnTo?: string;
  oportunidadId?: number | string;
};

// Muestra el header contextual cuando hay oportunidad activa.
export const CrmContextHeader = ({
  location,
  navigate,
  returnTo,
  oportunidadId,
}: CrmContextHeaderProps) => {
  const oportunidadIdNumeric =
    oportunidadId != null && Number.isFinite(Number(oportunidadId))
      ? Number(oportunidadId)
      : undefined;
  const shouldLoadOportunidad =
    typeof oportunidadIdNumeric === "number" && oportunidadIdNumeric > 0;
  const showContextHeader = Boolean(shouldLoadOportunidad);

  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: shouldLoadOportunidad ? oportunidadIdNumeric : undefined },
    { enabled: Boolean(shouldLoadOportunidad) }
  );
  const contactoId = (oportunidad as any)?.contacto_id ?? null;
  const { data: contacto } = useGetOne(
    "crm/contactos",
    { id: contactoId ?? 0 },
    { enabled: Boolean(contactoId) }
  );
  const contactoNombre =
    (contacto as any)?.nombre_completo ??
    (contacto as any)?.nombre ??
    (oportunidad as any)?.contacto?.nombre_completo ??
    (oportunidad as any)?.contacto?.nombre ??
    null;
  const oportunidadTitulo =
    (oportunidad as any)?.titulo ??
    (oportunidad as any)?.descripcion_estado ??
    (oportunidadIdNumeric ? `Oportunidad #${oportunidadIdNumeric}` : "");
  const contactoInitials = useMemo(() => {
    const base = contactoNombre ?? "Contacto";
    return base
      .split(/\s+/)
      .filter(Boolean)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [contactoNombre]);

  const handleOpenChat = () => {
    if (oportunidadIdNumeric) {
      const params = new URLSearchParams();
      params.set("returnTo", `${location.pathname}${location.search}`);
      navigate(`/crm/chat/op-${oportunidadIdNumeric}/show?${params.toString()}`);
      return;
    }
    navigate(returnTo ?? "/crm/chat");
  };

  const handleOpenOportunidad = () => {
    if (!oportunidadIdNumeric) return;
    const params = new URLSearchParams();
    params.set("returnTo", `${location.pathname}${location.search}`);
    navigate(`/crm/oportunidades/${oportunidadIdNumeric}?${params.toString()}`);
  };

  const handleOpenEventos = () => {
    if (!oportunidadIdNumeric) return;
    const params = new URLSearchParams();
    appendFilterParam(params, buildOportunidadFilter(oportunidadIdNumeric));
    params.set("context", "solicitudes");
    params.set("returnTo", `${location.pathname}${location.search}`);
    navigate(`/crm/eventos?${params.toString()}`);
  };

  if (!showContextHeader) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-3 py-2 shadow-sm sm:mb-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          if (returnTo) {
            navigate(returnTo);
          } else {
            navigate(-1);
          }
        }}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Avatar className="size-9 border border-slate-200">
        <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
          {contactoInitials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {contactoNombre ?? "Contacto"}
        </p>
        <p className="truncate text-[10px] text-slate-500">
          {oportunidadTitulo} ({oportunidadIdNumeric ?? ""})
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1 text-slate-400">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenChat}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenOportunidad}
          disabled={!oportunidadIdNumeric}
        >
          <House className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleOpenEventos}
          disabled={!oportunidadIdNumeric}
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
