"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
} from "ra-core";
import { useLocation, useNavigate } from "react-router";
import { ArrowRightLeft, MessageCircle, Trash2 } from "lucide-react";

import {
  FormOrderCancelButton,
  FormOrderEditButton,
} from "@/components/forms/form_order";
import { Show } from "@/components/show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  formatMensajeCanal,
  formatMensajeEstado,
  formatMensajePrioridad,
  formatMensajeTipo,
  getMensajeEstadoBadgeClass,
  getMensajePrioridadBadgeClass,
  getMensajeTipoBadgeClass,
  type CRMMensaje,
} from "./model";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatEstadoOportunidad,
  type CRMOportunidadEstado,
} from "../crm-oportunidades/model";

//#region Constantes y helpers puros

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Formatea una fecha y hora con un fallback legible para la vista detalle.
const formatDateTime = (value?: string | null, fallback = "Sin registro") => {
  if (!value) return fallback;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return fallback;

  return parsedDate.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// Devuelve el asunto sugerido para una respuesta sin duplicar el prefijo.
const ensureReplySubject = (subject?: string | null) => {
  if (!subject) return "RE:";

  const trimmedSubject = subject.trim();
  return trimmedSubject.toUpperCase().startsWith("RE:")
    ? trimmedSubject
    : `RE: ${trimmedSubject}`;
};

// Devuelve una referencia compacta del contacto y el origen del mensaje.
const getReferenciaTexto = (record: CRMMensaje) => {
  const contactoNombre =
    record.contacto?.nombre_completo ?? record.contacto?.nombre ?? "";
  const referenciaBase =
    record.contacto_referencia ?? record.origen_externo_id ?? "Sin referencia";

  if (record.contacto_id && contactoNombre) {
    return `${referenciaBase} -> ${contactoNombre}`;
  }

  return referenciaBase;
};

// Devuelve el nombre visible del contacto para encabezados y dialogos.
const getContactoNombre = (record: CRMMensaje) =>
  record.contacto?.nombre_completo ??
  record.contacto?.nombre ??
  record.contacto_nombre_propuesto ??
  (record.contacto_id ? `Contacto #${record.contacto_id}` : "Sin contacto");

// Devuelve una descripcion breve de la oportunidad asociada al mensaje.
const getOportunidadTexto = (record: CRMMensaje) =>
  record.oportunidad_id
    ? `${record.oportunidad?.descripcion_estado ?? record.oportunidad?.nombre ?? "Sin titulo"} (${record.oportunidad_id})`
    : "Sin oportunidad vinculada";

// Devuelve el badge visual que resume el estado de la oportunidad asociada.
const getOportunidadBadgeData = (record: CRMMensaje) => {
  const estado = record.oportunidad?.estado as CRMOportunidadEstado | undefined;

  if (!estado) {
    return {
      text: "Sin oportunidad",
      className: "bg-slate-400 text-white",
    };
  }

  const numero = estado.split("-")[0];
  const nombre = formatEstadoOportunidad(estado);

  return {
    text: numero && nombre ? `${numero} ${nombre}` : nombre ?? numero ?? "OK",
    className: CRM_OPORTUNIDAD_ESTADO_BADGES[estado],
  };
};

//#endregion Constantes y helpers puros

//#region Helpers de presentacion

// Renderiza una pareja etiqueta-valor consistente para vistas de solo lectura.
const DatoSoloLectura = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[8px] uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="text-[11px] font-medium text-foreground">{children}</div>
  </div>
);

// Renderiza un valor de texto con un fallback amigable cuando llega vacio.
const TextoConFallback = ({
  value,
  fallback = "Sin dato",
}: {
  value?: string | null;
  fallback?: string;
}) => <span>{value?.trim() ? value : fallback}</span>;

// Renderiza el badge del tipo del mensaje con el estilo del modelo.
const TipoMensajeBadge = ({ tipo }: { tipo?: CRMMensaje["tipo"] }) => (
  <Badge variant="secondary" className={getMensajeTipoBadgeClass(tipo)}>
    {formatMensajeTipo(tipo)}
  </Badge>
);

// Renderiza el badge del estado del mensaje con el estilo del modelo.
const EstadoMensajeBadge = ({
  estado,
}: {
  estado?: CRMMensaje["estado"];
}) => (
  <Badge variant="secondary" className={getMensajeEstadoBadgeClass(estado)}>
    {formatMensajeEstado(estado)}
  </Badge>
);

// Renderiza el badge de prioridad del mensaje con el estilo del modelo.
const PrioridadMensajeBadge = ({
  prioridad,
}: {
  prioridad?: CRMMensaje["prioridad"];
}) => (
  <Badge
    variant="secondary"
    className={getMensajePrioridadBadgeClass(prioridad)}
  >
    {formatMensajePrioridad(prioridad)}
  </Badge>
);

// Renderiza el badge del canal del mensaje usando un estilo neutro.
const CanalMensajeBadge = ({ canal }: { canal?: CRMMensaje["canal"] }) => (
  <Badge variant="outline" className="text-[10px]">
    {formatMensajeCanal(canal)}
  </Badge>
);

//#endregion Helpers de presentacion

//#region Dialogos operativos

type ResponderDialogProps = {
  open: boolean;
  loading: boolean;
  contactoNombre: string;
  replySubject: string;
  replyContent: string;
  record: CRMMensaje;
  onClose: () => void;
  onContactoNombreChange: (value: string) => void;
  onReplyContentChange: (value: string) => void;
  onSubmit: () => void;
};

// Renderiza el dialogo de respuesta manteniendo visible el contexto del mensaje.
const ResponderDialog = ({
  open,
  loading,
  contactoNombre,
  replySubject,
  replyContent,
  record,
  onClose,
  onContactoNombreChange,
  onReplyContentChange,
  onSubmit,
}: ResponderDialogProps) => (
  <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Responder mensaje</DialogTitle>
        <DialogDescription>
          Redacta una respuesta manteniendo visible el contexto operativo.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <Card className="border-border/50 bg-muted/20 p-4 shadow-none">
          <div className="grid gap-4 md:grid-cols-2">
            <DatoSoloLectura label="Contacto">
              {getContactoNombre(record)}
            </DatoSoloLectura>
            <DatoSoloLectura label="Referencia">
              {getReferenciaTexto(record)}
            </DatoSoloLectura>
            <DatoSoloLectura label="Asunto sugerido">
              <TextoConFallback value={replySubject} fallback="RE:" />
            </DatoSoloLectura>
            <DatoSoloLectura label="Oportunidad">
              {getOportunidadTexto(record)}
            </DatoSoloLectura>
          </div>
        </Card>

        {!record.contacto_id ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre del contacto <span className="text-red-500">*</span>
            </p>
            <Input
              value={contactoNombre}
              onChange={(event) => onContactoNombreChange(event.target.value)}
              placeholder="Ingresa el nombre del contacto"
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Respuesta
          </p>
          <Textarea
            rows={10}
            className="min-h-[220px]"
            value={replyContent}
            onChange={(event) => onReplyContentChange(event.target.value)}
            placeholder="Escribe tu respuesta..."
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Guardando..." : "Guardar respuesta"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

type DescartarDialogProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

// Renderiza el dialogo de confirmacion para marcar el mensaje como descartado.
const DescartarDialog = ({
  open,
  loading,
  onClose,
  onConfirm,
}: DescartarDialogProps) => (
  <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
    <DialogContent
      className="bg-white"
      overlayClassName="bg-transparent backdrop-blur-none"
    >
      <DialogHeader>
        <DialogTitle>Descartar mensaje</DialogTitle>
        <DialogDescription>
          Esta accion marcara el mensaje como descartado. Deseas continuar?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={loading}>
          {loading ? "Descartando..." : "Confirmar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

//#endregion Dialogos operativos

//#region Tarjetas de detalle

// Renderiza el titulo contextual de la vista detalle del mensaje.
const CRMMensajeShowTitle = () => {
  const record = useRecordContext<CRMMensaje>();
  if (!record) return "Mensaje CRM";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Mensaje CRM</span>
      <Badge variant="outline" className="text-[11px]">
        #{String(record.id ?? "").padStart(6, "0")}
      </Badge>
      <TipoMensajeBadge tipo={record.tipo} />
      <EstadoMensajeBadge estado={record.estado} />
      <PrioridadMensajeBadge prioridad={record.prioridad} />
    </div>
  );
};

// Renderiza la tarjeta con metadatos base del mensaje.
const MensajeResumenCard = ({ record }: { record: CRMMensaje }) => (
  <Card className="p-4">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <DatoSoloLectura label="ID">
        <span>{record.id}</span>
      </DatoSoloLectura>
      <DatoSoloLectura label="Fecha mensaje">
        {formatDateTime(record.fecha_mensaje)}
      </DatoSoloLectura>
      <DatoSoloLectura label="Fecha estado">
        {formatDateTime(record.fecha_estado)}
      </DatoSoloLectura>
      <DatoSoloLectura label="Tipo">
        <span className="inline-flex">
          <TipoMensajeBadge tipo={record.tipo} />
        </span>
      </DatoSoloLectura>
      <DatoSoloLectura label="Canal">
        <span className="inline-flex">
          <CanalMensajeBadge canal={record.canal} />
        </span>
      </DatoSoloLectura>
      <DatoSoloLectura label="Estado">
        <span className="inline-flex">
          <EstadoMensajeBadge estado={record.estado} />
        </span>
      </DatoSoloLectura>
      <DatoSoloLectura label="Prioridad">
        <span className="inline-flex">
          <PrioridadMensajeBadge prioridad={record.prioridad} />
        </span>
      </DatoSoloLectura>
      <DatoSoloLectura label="Contacto">
        {getContactoNombre(record)}
      </DatoSoloLectura>
      <DatoSoloLectura label="Responsable">
        <TextoConFallback
          value={record.responsable?.nombre_completo ?? record.responsable?.nombre}
          fallback="Sin responsable"
        />
      </DatoSoloLectura>
      <DatoSoloLectura label="Referencia">
        {getReferenciaTexto(record)}
      </DatoSoloLectura>
      <DatoSoloLectura label="ID externo">
        <TextoConFallback
          value={record.origen_externo_id}
          fallback="Sin ID externo"
        />
      </DatoSoloLectura>
      <DatoSoloLectura label="Asunto">
        <TextoConFallback value={record.asunto} fallback="Sin asunto" />
      </DatoSoloLectura>
    </div>
  </Card>
);

// Renderiza la tarjeta con el contexto comercial asociado al mensaje.
const MensajeOportunidadCard = ({ record }: { record: CRMMensaje }) => {
  const oportunidadBadge = getOportunidadBadgeData(record);
  const hasOportunidad = Boolean(record.oportunidad_id);

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contexto comercial
            </p>
            <p className="text-[11px] text-muted-foreground">
              Relacion del mensaje con oportunidad y propiedad asociadas.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex min-h-[1.4rem] min-w-[5rem] items-center justify-center rounded-full px-2.5 text-[9px] font-semibold uppercase leading-none text-white shadow-sm",
              oportunidadBadge.className,
            )}
          >
            {oportunidadBadge.text}
          </span>
        </div>

        {hasOportunidad ? (
          <div className="grid gap-4 md:grid-cols-2">
            <DatoSoloLectura label="Oportunidad">
              {getOportunidadTexto(record)}
            </DatoSoloLectura>
            <DatoSoloLectura label="Propiedad">
              <TextoConFallback
                value={record.oportunidad?.propiedad?.nombre}
                fallback="Sin propiedad"
              />
            </DatoSoloLectura>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
            <ArrowRightLeft className="h-4 w-4" />
            <span>No se registro una oportunidad vinculada.</span>
          </div>
        )}
      </div>
    </Card>
  );
};

// Renderiza la tarjeta con el contenido del mensaje y sus acciones operativas.
const MensajeContenidoCard = ({
  record,
  onReply,
  onDiscard,
}: {
  record: CRMMensaje;
  onReply: () => void;
  onDiscard: () => void;
}) => (
  <Card className="p-4">
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/40 pb-3 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensaje
          </p>
          <p className="text-[11px] text-muted-foreground">
            Contenido recibido o generado dentro del flujo CRM.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button variant="outline" onClick={onReply}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Responder
          </Button>
          {record.estado === "nuevo" ? (
            <Button
              variant="outline"
              className="border-destructive/60 text-destructive hover:bg-destructive/10"
              onClick={onDiscard}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Descartar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-background/95 p-5 text-sm leading-7 text-foreground shadow-inner">
        {record.contenido || "Sin contenido disponible."}
      </div>
    </div>
  </Card>
);

//#endregion Tarjetas de detalle

//#region Componente principal

// Renderiza el detalle completo del mensaje manteniendo separadas las acciones operativas.
const CRMMensajeShowContent = () => {
  const record = useRecordContext<CRMMensaje>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const redirect = useRedirect();
  const refresh = useRefresh();
  const location = useLocation();
  const navigate = useNavigate();
  const initialAction = (location.state as { action?: string } | null)?.action;

  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardLoading, setDiscardLoading] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [contactoNombre, setContactoNombre] = useState("");
  const [cameFromAction, setCameFromAction] = useState(false);

  useEffect(() => {
    if (initialAction === "discard") {
      setDiscardOpen(true);
      setCameFromAction(true);
    }

    if (initialAction) {
      navigate(".", { replace: true, state: null });
    }
  }, [initialAction, navigate]);

  useEffect(() => {
    setContactoNombre(record ? getContactoNombre(record) : "");
  }, [record]);

  if (!record) return null;

  const replySubject = ensureReplySubject(record.asunto);

  // Persiste el descarte del mensaje y vuelve al listado al finalizar.
  const handleDescartar = async () => {
    setDiscardLoading(true);

    try {
      await dataProvider.update("crm/mensajes", {
        id: record.id,
        data: { ...record, estado: "descartado" },
        previousData: record,
      });

      notify("Mensaje descartado", { type: "success" });
      setDiscardOpen(false);
      redirect("list", "crm/mensajes");
    } catch (error: any) {
      notify(error?.message ?? "No se pudo descartar el mensaje", {
        type: "warning",
      });
    } finally {
      setDiscardLoading(false);
    }
  };

  // Guarda la respuesta sobre el mensaje respetando el flujo actual del backend.
  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      notify("Completa la respuesta antes de enviar.", { type: "warning" });
      return;
    }

    if (!record.contacto_id && !contactoNombre.trim()) {
      notify("El nombre del contacto es obligatorio.", { type: "warning" });
      return;
    }

    setReplyLoading(true);

    try {
      const response = await fetch(`${API_URL}/crm/mensajes/${record.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: replyContent }),
      });

      if (!response.ok) {
        let errorMessage = `Error al enviar la respuesta (HTTP ${response.status})`;

        try {
          const errorBody = await response.json();
          errorMessage = errorBody?.detail || errorMessage;
        } catch {
          // El endpoint puede responder sin JSON estructurado.
        }

        throw new Error(errorMessage);
      }

      const resultado = await response.json();
      notify("Respuesta guardada para enviar", { type: "success" });

      if (resultado.contacto_creado) {
        notify("Contacto creado automaticamente", { type: "info" });
      }

      if (resultado.oportunidad_creada) {
        notify("Oportunidad creada automaticamente", { type: "info" });
      }

      setReplyDialogOpen(false);
      setReplyContent("");
      refresh();
    } catch (error: any) {
      notify(error?.message ?? "No se pudo guardar la respuesta", {
        type: "warning",
      });
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl space-y-4">
        <MensajeResumenCard record={record} />
        <MensajeOportunidadCard record={record} />
        <MensajeContenidoCard
          record={record}
          onReply={() => setReplyDialogOpen(true)}
          onDiscard={() => setDiscardOpen(true)}
        />

        <div className="flex justify-end gap-2">
          <FormOrderCancelButton />
        </div>
      </div>

      <ResponderDialog
        open={replyDialogOpen}
        loading={replyLoading}
        contactoNombre={contactoNombre}
        replySubject={replySubject}
        replyContent={replyContent}
        record={record}
        onClose={() => setReplyDialogOpen(false)}
        onContactoNombreChange={setContactoNombre}
        onReplyContentChange={setReplyContent}
        onSubmit={handleReplySubmit}
      />

      <DescartarDialog
        open={discardOpen}
        loading={discardLoading}
        onClose={() => {
          if (cameFromAction) {
            redirect("list", "crm/mensajes");
            return;
          }

          setDiscardOpen(false);
        }}
        onConfirm={handleDescartar}
      />
    </>
  );
};

// Renderiza la pantalla de detalle con el mismo contrato visual del resto de los CRUD.
export const CRMMensajeShow = () => (
  <Show
    className="w-full max-w-4xl"
    title={<CRMMensajeShowTitle />}
    actions={<FormOrderEditButton />}
  >
    <CRMMensajeShowContent />
  </Show>
);

//#endregion Componente principal
