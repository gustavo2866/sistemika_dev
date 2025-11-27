"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataProvider, useRecordContext } from "ra-core";
import { ArrowDownCircle, ArrowUpCircle, CalendarClock } from "lucide-react";

import { FormSimpleSection } from "@/components/forms";
import type { CRMEvento } from "../crm-eventos/model";
import type { CRMOportunidad } from "./model";
import type { CRMMensaje } from "../crm-inbox/model";

const formatDateTimeValue = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";
  return date.toLocaleString("es-AR", options ?? { dateStyle: "short", timeStyle: "short" });
};

const ActividadTimeline = () => {
  const record = useRecordContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const [eventos, setEventos] = useState<CRMEvento[]>([]);
  const [mensajes, setMensajes] = useState<CRMMensaje[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record?.id) {
      setEventos([]);
      setMensajes([]);
      return;
    }
    let cancel = false;
    const fetchActividad = async () => {
      setLoading(true);
      try {
        const [eventosResp, mensajesResp] = await Promise.all([
          dataProvider.getList<CRMEvento>("crm/eventos", {
            filter: { oportunidad_id: record.id },
            pagination: { page: 1, perPage: 25 },
            sort: { field: "fecha_evento", order: "DESC" },
          }),
          dataProvider.getList<CRMMensaje>("crm/mensajes", {
            filter: { oportunidad_id: record.id },
            pagination: { page: 1, perPage: 25 },
            sort: { field: "created_at", order: "DESC" },
          }),
        ]);
        if (!cancel) {
          setEventos(eventosResp.data ?? []);
          setMensajes(mensajesResp.data ?? []);
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };
    fetchActividad();
    return () => {
      cancel = true;
    };
  }, [dataProvider, record?.id]);

  const items = useMemo(() => {
    const activity = Array.from(
      [
        ...eventos.map((evento) => ({
          id: `evento-${evento.id}`,
          kind: "evento" as const,
          date: evento.fecha_evento || "",
          title: evento.tipo?.nombre ?? "Evento",
          description: evento.descripcion,
          meta: [evento.motivo?.nombre, evento.estado_evento].filter(Boolean).join(" · "),
        })),
        ...mensajes.map((mensaje) => ({
          id: `mensaje-${mensaje.id}`,
          kind: "mensaje" as const,
          date: mensaje.fecha_mensaje || mensaje.created_at || "",
          title: mensaje.asunto || `Mensaje ${mensaje.tipo ?? ""}`,
          description: mensaje.contenido,
          meta: [mensaje.canal, mensaje.estado].filter(Boolean).join(" · "),
          direction: mensaje.tipo === "salida" ? "salida" : "entrada",
        })),
      ].values()
    );
    activity.sort(
      (a, b) =>
        (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)
    );
    return activity;
  }, [eventos, mensajes]);

  if (!record?.id) {
    return <p className="text-sm text-muted-foreground">Disponible luego de guardar la oportunidad.</p>;
  }

  return (
    <FormSimpleSection className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando actividad...</p>
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <div className="rounded-lg border bg-card/40">
          <div className="h-[360px] overflow-y-auto pr-2 space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex w-12 flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-sm ${
                      item.kind === "evento"
                        ? "text-amber-600 border-amber-200 bg-amber-50"
                        : item.direction === "entrada"
                        ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                        : "text-blue-700 border-blue-200 bg-blue-50"
                    }`}
                  >
                    {item.kind === "evento" ? (
                      <CalendarClock className="h-4 w-4" />
                    ) : item.direction === "entrada" ? (
                      <ArrowDownCircle className="h-4 w-4" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4" />
                    )}
                  </div>
                  {index < items.length - 1 ? (
                    <div className="w-px flex-1 bg-muted mt-1" />
                  ) : null}
                </div>
                <div
                  className={`flex-1 rounded-lg border bg-card/70 p-3 shadow-sm ${
                    index < 5 ? "ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold leading-tight">{item.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeValue(item.date)}
                    </span>
                  </div>
                  {item.meta ? (
                    <p className="text-xs text-muted-foreground">{item.meta}</p>
                  ) : null}
                  {item.description ? (
                    <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-3">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </FormSimpleSection>
  );
};

export default ActividadTimeline;
