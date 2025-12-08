"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  useCreatePath,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
} from "ra-core";
import { ArrowRightCircle, CalendarPlus, Archive, X, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  KanbanActionButton,
  KanbanBadge,
  KanbanCard,
  KanbanCardBody,
  KanbanCardFooter,
  KanbanCardHeader,
  KanbanCardSubtitle,
  KanbanCardTitle,
} from "./card";
import type { CRMOportunidad } from "@/app/resources/crm-oportunidades/model";
import { CRM_OPORTUNIDAD_ESTADO_BADGES, formatEstadoOportunidad } from "@/app/resources/crm-oportunidades/model";
import { EVENT_TYPE_CHOICES, DEFAULT_EVENT_STATE, getDefaultDateTime } from "@/app/resources/crm-mensajes/model";
import { CRMOportunidadDescartarDialog } from "@/app/resources/crm-oportunidades/form_descartar";
import { CRMOportunidadAceptarDialog } from "@/app/resources/crm-oportunidades/form_aceptar";
import { CRMOportunidadCerrarDialog } from "@/app/resources/crm-oportunidades/form_cerrar";
import { CRMOportunidadAgendarDialog } from "@/app/resources/crm-oportunidades/form_agendar";
import { CRMOportunidadCotizarDialog } from "@/app/resources/crm-oportunidades/form_cotizar";
import { CRMOportunidadArchivarDialog } from "@/app/resources/crm-oportunidades/form_archivar";

type DragStartHandler = (event: React.DragEvent<HTMLDivElement>, id: number) => void;

export interface CRMOportunidadKanbanCardProps {
  record: CRMOportunidad;
  onDragStart: DragStartHandler;
  collapsed?: boolean;
  onToggleCollapse?: (record: CRMOportunidad) => void;
}

export const CRMOportunidadKanbanCard = ({
  record,
  onDragStart,
  collapsed = false,
  onToggleCollapse,
}: CRMOportunidadKanbanCardProps) => {
  const createPath = useCreatePath();
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showCompletarDialog, setShowCompletarDialog] = useState(false);
  const [showCerrarDialog, setShowCerrarDialog] = useState(false);
  const [showVisitaDialog, setShowVisitaDialog] = useState(false);
  const [showCotizarDialog, setShowCotizarDialog] = useState(false);
  const [showArchivarDialog, setShowArchivarDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [perderMotivoId, setPerderMotivoId] = useState("");
  const [perderNota, setPerderNota] = useState("");

  const visitaDefaultType =
    EVENT_TYPE_CHOICES.find((choice) => choice.value === "visita")?.value ?? EVENT_TYPE_CHOICES[0].value;
  const [visitaForm, setVisitaForm] = useState({
    titulo: "",
    descripcion: "",
    tipoEvento: visitaDefaultType,
    datetime: getDefaultDateTime(),
    asignadoId: "",
  });
  const [cotizarForm, setCotizarForm] = useState({
    propiedadId: "",
    tipoPropiedadId: "",
    monto: "",
    monedaId: "",
    condicionPagoId: "",
    formaPagoDescripcion: "",
  });

  const { data: motivosPerdida } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: responsablesData } = useGetList("users", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: propiedadesData } = useGetList("propiedades", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: tiposPropiedadData } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: monedasData } = useGetList("monedas", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: condicionesPagoData } = useGetList("crm/catalogos/condiciones-pago", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });

  const responsables = useMemo(
    () =>
      (responsablesData ?? []).map((user: any) => ({
        value: String(user.id),
        label: user.nombre_completo || user.nombre || user.email || `Usuario #${user.id}`,
      })),
    [responsablesData]
  );
  const propiedades = useMemo(
    () =>
      (propiedadesData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Propiedad #${item.id}`,
      })),
    [propiedadesData]
  );
  const tiposPropiedad = useMemo(
    () =>
      (tiposPropiedadData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Tipo #${item.id}`,
      })),
    [tiposPropiedadData]
  );
  const monedas = useMemo(
    () =>
      (monedasData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.simbolo ?? item.codigo ?? item.nombre ?? `Moneda #${item.id}`,
      })),
    [monedasData]
  );
  const condicionesPago = useMemo(
    () =>
      (condicionesPagoData ?? []).map((item: any) => ({
        value: String(item.id),
        label: item.nombre ?? `Condición #${item.id}`,
      })),
    [condicionesPagoData]
  );

  useEffect(() => {
    if (showVisitaDialog) {
      setVisitaForm({
        titulo: record.titulo ? `Visita - ${record.titulo}` : "Visita programada",
        descripcion: "",
        tipoEvento: visitaDefaultType,
        datetime: getDefaultDateTime(),
        asignadoId: identity?.id != null ? String(identity.id) : responsables[0]?.value ?? "",
      });
    }
  }, [showVisitaDialog, record.titulo, visitaDefaultType, identity?.id, responsables]);

  useEffect(() => {
    if (showCotizarDialog) {
      setCotizarForm({
        propiedadId: record.propiedad_id ? String(record.propiedad_id) : "",
        tipoPropiedadId: record.tipo_propiedad_id ? String(record.tipo_propiedad_id) : "",
        monto: record.monto ? String(record.monto) : "",
        monedaId: record.moneda_id ? String(record.moneda_id) : "",
        condicionPagoId: record.condicion_pago_id ? String(record.condicion_pago_id) : "",
        formaPagoDescripcion: record.forma_pago_descripcion ?? "",
      });
    }
  }, [
    showCotizarDialog,
    record.propiedad_id,
    record.tipo_propiedad_id,
    record.monto,
    record.moneda_id,
    record.condicion_pago_id,
    record.forma_pago_descripcion,
  ]);

  const handleOpen = () => {
    const to = createPath({
      resource: "crm/oportunidades",
      type: "edit",
      id: record.id,
    });
    navigate(to, { state: { fromPanel: true } });
  };

  const estadoClass = CRM_OPORTUNIDAD_ESTADO_BADGES[record.estado] ?? "bg-slate-100 text-slate-800";

  const handleDescartar = async () => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { activo: false },
        previousData: record,
      });
      notify("Oportunidad descartada", { type: "success" });
      setShowDescartarDialog(false);
      refresh();
    } catch (error) {
      console.error("Error al descartar la oportunidad", error);
      notify("Error al descartar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletar = async (data: any) => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { ...data, estado: "1-abierta" },
        previousData: record,
      });
      notify("Oportunidad completada y movida a Abierta", { type: "success" });
      setShowCompletarDialog(false);
      refresh();
    } catch (error) {
      console.error("Error al completar la oportunidad", error);
      notify("Error al completar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCerrarOportunidad = async () => {
    if (!perderMotivoId) {
      notify("Seleccioná un motivo de pérdida.", { type: "warning" });
      return;
    }
    setIsProcessing(true);
    try {
      const data: Record<string, unknown> = {
        motivo_perdida_id: Number(perderMotivoId),
        estado: "6-perdida",
        fecha_estado: new Date().toISOString(),
      };
      if (perderNota.trim()) {
        data.descripcion_estado = perderNota.trim();
      }
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data,
        previousData: record,
      });
      notify("Oportunidad marcada como pérdida", { type: "success" });
      setShowCerrarDialog(false);
      setPerderMotivoId("");
      setPerderNota("");
      refresh();
    } catch (error) {
      console.error("No se pudo cerrar la oportunidad", error);
      notify("No se pudo cerrar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAgendarVisita = async () => {
    const { titulo, descripcion, tipoEvento, datetime, asignadoId } = visitaForm;
    if (!titulo.trim()) {
      notify("Ingresa un título para la visita.", { type: "warning" });
      return;
    }
    if (!datetime) {
      notify("Selecciona fecha y hora.", { type: "warning" });
      return;
    }
    if (!asignadoId) {
      notify("Selecciona el responsable.", { type: "warning" });
      return;
    }

    const payload: Record<string, unknown> = {
      oportunidad_id: record.id,
      fecha_evento: new Date(datetime).toISOString(),
      titulo: titulo.trim(),
      tipo_evento: tipoEvento,
      estado_evento: DEFAULT_EVENT_STATE,
      asignado_a_id: Number(asignadoId),
    };
    if (descripcion.trim()) {
      payload.descripcion = descripcion.trim();
    }

    setIsProcessing(true);
    try {
      await dataProvider.create("crm/eventos", { data: payload });
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { estado: "2-visita", fecha_estado: new Date().toISOString() },
        previousData: record,
      });
      notify("Visita agendada y oportunidad confirmada", { type: "success" });
      setShowVisitaDialog(false);
      refresh();
    } catch (error) {
      console.error("No se pudo agendar la visita", error);
      notify("No se pudo agendar la visita", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCotizarSubmit = async () => {
    setIsProcessing(true);
    try {
      const payload: Record<string, unknown> = {
        estado: "3-cotiza",
        fecha_estado: new Date().toISOString(),
      };
      const toNumber = (value: string) => (value ? Number(value) : null);
      payload.propiedad_id = toNumber(cotizarForm.propiedadId);
      payload.tipo_propiedad_id = toNumber(cotizarForm.tipoPropiedadId);
      payload.moneda_id = toNumber(cotizarForm.monedaId);
      payload.condicion_pago_id = toNumber(cotizarForm.condicionPagoId);
      payload.monto = cotizarForm.monto ? Number(cotizarForm.monto) : null;
      const descripcion = cotizarForm.formaPagoDescripcion.trim();
      if (descripcion) {
        payload.forma_pago_descripcion = descripcion;
      }

      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: payload,
        previousData: record,
      });
      notify("Oportunidad actualizada a Cotiza", { type: "success" });
      setShowCotizarDialog(false);
      refresh();
    } catch (error) {
      console.error("No se pudo actualizar la oportunidad a Cotiza", error);
      notify("No se pudo actualizar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchivar = async () => {
    setIsProcessing(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: record.id,
        data: { activo: false },
        previousData: record,
      });
      notify("Oportunidad archivada", { type: "success" });
      setShowArchivarDialog(false);
      refresh();
    } catch (error) {
      console.error("No se pudo archivar la oportunidad", error);
      notify("No se pudo archivar la oportunidad", { type: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // @ts-expect-error - contacto está expandido en la respuesta
  const contactoNombre = record.contacto?.nombre_completo || `Contacto #${record.contacto_id}`;
  const responsableData: any = (record as any).responsable;
  const responsableName =
    responsableData?.nombre ??
    responsableData?.nombre_completo ??
    responsableData?.full_name ??
    `Usuario #${record.responsable_id ?? "?"}`;
  const responsableAvatar = responsableData?.avatar ?? responsableData?.url_foto ?? null;
  const responsableInitials = useMemo(() => {
    const name = responsableName ?? "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return "??";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [responsableName]);

  const isProspect = record.estado === "0-prospect";
  const isOpen = record.estado === "1-abierta";
  const isVisit = record.estado === "2-visita";
  const isCotiza = record.estado === "3-cotiza";
  const isReserva = record.estado === "4-reserva";
  const isGanada = record.estado === "5-ganada";
  const isPerdida = record.estado === "6-perdida";
  const accentState = isProspect || isOpen || isVisit || isCotiza || isReserva;
  const showFooterActions = isProspect || isOpen || isVisit || isCotiza || isReserva || isGanada || isPerdida;

  const handleCardDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (onToggleCollapse) {
      onToggleCollapse(record);
    }
  };

  return (
    <KanbanCard
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => onDragStart(event, record.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleOpen();
        }
      }}
      onDoubleClick={handleCardDoubleClick}
      className={cn(
        "cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
        collapsed ? "py-2" : "",
      )}
    >
      <KanbanCardHeader className="text-[10px] font-semibold text-muted-foreground">
        <Avatar className="size-7 border border-slate-200 shadow-sm">
          {responsableAvatar ? <AvatarImage src={responsableAvatar} alt={responsableName} /> : null}
          <AvatarFallback className="bg-slate-100 text-[10px] font-semibold uppercase text-slate-600">
            {responsableInitials}
          </AvatarFallback>
        </Avatar>
        <div className="ml-auto flex items-center gap-1">
          <KanbanBadge className={cn("border-transparent text-[9px] font-semibold", estadoClass)}>
            {formatEstadoOportunidad(record.estado)}
          </KanbanBadge>
          <button
            type="button"
            aria-label="Editar oportunidad"
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </KanbanCardHeader>
      <KanbanCardBody className={cn("mt-1", collapsed ? "text-[11px]" : "")}>
        <div className="flex items-start gap-2">
          {accentState ? (
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 shadow-inner">
              #{record.id}
            </span>
          ) : null}
          <div className="flex-1">
            <KanbanCardTitle className="text-xs font-bold leading-tight text-foreground line-clamp-2">
              {record.titulo || "Sin título"}
            </KanbanCardTitle>
            <KanbanCardSubtitle className="mt-0.5 text-[10px] text-muted-foreground">
              {contactoNombre}
            </KanbanCardSubtitle>
          </div>
        </div>
      </KanbanCardBody>
      {!collapsed && showFooterActions ? (
        <KanbanCardFooter className="mt-3 flex flex-col items-stretch gap-2 pt-0">
          {isProspect && (
            <div className="rounded-xl border border-sky-200/70 bg-white/80 p-2">
              <div className="flex gap-1.5">
                <KanbanActionButton
                  icon={<X className="h-3 w-3 text-slate-500" />}
                  className="flex-1 h-6 justify-center text-[10px] text-slate-500 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDescartarDialog(true);
                  }}
                >
                  Cerrar
                </KanbanActionButton>
                <KanbanActionButton
                  icon={<ArrowRightCircle className="h-3 w-3 text-sky-600" />}
                  className="flex-1 h-6 justify-center text-[10px] text-sky-700 border-sky-200 bg-white/80 hover:bg-sky-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompletarDialog(true);
                  }}
                >
                  Aceptar
                </KanbanActionButton>
              </div>
            </div>
          )}
          {isOpen && (
            <div className="rounded-xl border border-sky-200/70 bg-white/80 p-2">
              <div className="flex gap-1.5">
                <KanbanActionButton
                  icon={<X className="h-3 w-3 text-slate-500" />}
                  className="flex-1 h-6 justify-center text-[10px] text-slate-500 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCerrarDialog(true);
                  }}
                >
                  Cerrar
                </KanbanActionButton>
                <KanbanActionButton
                  icon={<CalendarPlus className="h-3 w-3 text-sky-600" />}
                  className="flex-1 h-6 justify-center text-[10px] text-sky-700 border-sky-200 bg-white/80 hover:bg-sky-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVisitaDialog(true);
                  }}
                >
                  Agendar
                </KanbanActionButton>
              </div>
            </div>
          )}
          {(isVisit || isCotiza || isReserva) && (
            <div className="rounded-xl border border-sky-200/70 bg-white/80 p-2">
              <div className="flex gap-1.5">
                <KanbanActionButton
                  icon={<X className="h-3 w-3 text-slate-500" />}
                  className="flex-1 h-6 justify-center text-[10px] text-slate-500 hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCerrarDialog(true);
                  }}
                >
                  Cerrar
                </KanbanActionButton>
                {isVisit && (
                  <KanbanActionButton
                    icon={<ArrowRightCircle className="h-3 w-3 text-sky-600" />}
                    className="flex-1 h-6 justify-center text-[10px] text-sky-700 border-sky-200 bg-white/80 hover:bg-sky-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCotizarDialog(true);
                    }}
                  >
                    Cotizar
                  </KanbanActionButton>
                )}
              </div>
            </div>
          )}
          {(isGanada || isPerdida) && (
            <div className="rounded-xl border border-slate-200/70 bg-white/85 p-2">
              <KanbanActionButton
                icon={<Archive className="h-3 w-3 text-slate-600" />}
                className="h-6 justify-center text-[10px] text-slate-600 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowArchivarDialog(true);
                }}
              >
                Archivar
              </KanbanActionButton>
            </div>
          )}
        </KanbanCardFooter>
      ) : null}

      <CRMOportunidadDescartarDialog
        open={showDescartarDialog}
        onOpenChange={setShowDescartarDialog}
        onConfirm={handleDescartar}
        disabled={isProcessing}
      />

      <CRMOportunidadArchivarDialog
        open={showArchivarDialog}
        onOpenChange={setShowArchivarDialog}
        onConfirm={handleArchivar}
        disabled={isProcessing}
      />

      <CRMOportunidadCerrarDialog
        open={showCerrarDialog}
        onOpenChange={setShowCerrarDialog}
        motivoOptions={(motivosPerdida ?? []).map((motivo: any) => ({
          value: String(motivo.id),
          label: motivo.nombre,
        }))}
        perderMotivoId={perderMotivoId}
        onPerderMotivoChange={setPerderMotivoId}
        perderNota={perderNota}
        onPerderNotaChange={setPerderNota}
        onConfirm={handleCerrarOportunidad}
        disabled={isProcessing}
      />

      <CRMOportunidadAceptarDialog
        open={showCompletarDialog}
        onOpenChange={setShowCompletarDialog}
        record={record}
        onComplete={handleCompletar}
        isProcessing={isProcessing}
      />
      <CRMOportunidadAgendarDialog
        open={showVisitaDialog}
        onOpenChange={setShowVisitaDialog}
        formValues={visitaForm}
        onFormChange={setVisitaForm}
        tipoEventoOptions={EVENT_TYPE_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
        responsableOptions={responsables}
        onSubmit={handleAgendarVisita}
        disabled={isProcessing}
      />

      <CRMOportunidadCotizarDialog
        open={showCotizarDialog}
        onOpenChange={setShowCotizarDialog}
        formValues={cotizarForm}
        onFormChange={setCotizarForm}
        propiedades={propiedades}
        tiposPropiedad={tiposPropiedad}
        monedas={monedas}
        condicionesPago={condicionesPago}
        onSubmit={handleCotizarSubmit}
        disabled={isProcessing}
      />
    </KanbanCard>
  );
};
