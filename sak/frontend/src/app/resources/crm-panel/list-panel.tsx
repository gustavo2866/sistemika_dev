"use client";

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ResourceTitle } from "@/components/resource-title";
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  FileText,
  FolderOpen,
  Sparkles,
  Target,
  XCircle,
} from "lucide-react";
import { useListContext, useDataProvider, useNotify, useRefresh, useGetList, useGetIdentity } from "ra-core";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { CRM_OPORTUNIDAD_ESTADOS } from "../crm-oportunidades/model";
import { CRMOportunidadKanbanCard } from "./crm-panel-card";
import { KanbanBoardView } from "@/components/kanban";
import { calculateOportunidadBucketKey, prepareMoveOportunidadPayload, getBucketLabel } from "./model";
import { ESTADO_BG_COLORS, getResponsableName, getContactoName, type BucketKey } from "./crm-panel-helpers";
import { OportunidadCustomFilters } from "./crm-panel-customFilters";
import { CRMOportunidadDescartarDialog } from "./form_descartar";
import { CRMOportunidadAgendarDialog } from "./form_agendar";
import { CRMOportunidadCotizarDialog } from "./form_cotizar";
import { CRMOportunidadCerrarDialog } from "./form_cerrar";
import { CRMOportunidadAceptarDialog } from "./form_aceptar";

// Definición de buckets (usando todos los estados)
const getBucketHeader = (estado: BucketKey, label: string) => {
  switch (estado) {
    case "0-prospect":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
          <Sparkles className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "1-abierta":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          <FolderOpen className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "2-visita":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
          <Calendar className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "3-cotiza":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          <FileText className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "4-reserva":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          <Bookmark className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "5-ganada":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    case "6-perdida":
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
          <XCircle className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
      );
  }
};

const getBuckets = () => {
  return CRM_OPORTUNIDAD_ESTADOS.map((estado) => {
    const label = getBucketLabel(estado);
    return {
      key: estado as BucketKey,
      title: label,
      helper: "",
      accentClass: ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70",
      bucketClassName: "max-w-[260px] w-full justify-self-center",
      headerContent: getBucketHeader(estado as BucketKey, label),
    };
  });
};

// Filtro de búsqueda
const searchFilterFn = (oportunidad: CRMOportunidad, searchTerm: string) => {
  const titulo = oportunidad.titulo ?? "";
  const contacto = getContactoName(oportunidad);
  const responsable = getResponsableName(oportunidad);
  const id = String(oportunidad.id);
  
  return (
    titulo.toLowerCase().includes(searchTerm) ||
    contacto.toLowerCase().includes(searchTerm) ||
    responsable.toLowerCase().includes(searchTerm) ||
    id.includes(searchTerm)
  );
};

// Filtro de responsable
const ownerFilterFn = (oportunidad: CRMOportunidad, ownerId: string) => {
  const oportunidadOwnerId = (oportunidad as any).responsable?.id ?? oportunidad.responsable_id;
  return String(oportunidadOwnerId ?? "") === ownerId;
};

const filters = [
  <ReferenceInput key="contacto_id" source="contacto_id" reference="crm/contactos" label="Contacto">
    <SelectInput optionText="nombre_completo" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_operacion_id"
    source="tipo_operacion_id"
    reference="crm/catalogos/tipos-operacion"
    label="Tipo de operación"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput key="propiedad_id" source="propiedad_id" reference="propiedades" label="Propiedad">
    <SelectInput optionText="nombre" emptyText="Todas" />
  </ReferenceInput>,
  <ReferenceInput key="responsable_id" source="responsable_id" reference="users" label="Responsable">
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton state={{ fromPanel: true }} />
    <ExportButton />
  </div>
);

const OportunidadListContent = () => {
  const { data: oportunidades = [], isLoading } = useListContext<CRMOportunidad>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const navigate = useNavigate();

  // Obtener catálogos necesarios
  const { data: tiposEvento = [] } = useGetList("crm/catalogos/tipos-evento", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: usuarios = [] } = useGetList("users", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: propiedades = [] } = useGetList("propiedades", {
    pagination: { page: 1, perPage: 500 },
  });
  const { data: tiposPropiedad = [] } = useGetList("tipos-propiedad", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: monedas = [] } = useGetList("monedas", {
    pagination: { page: 1, perPage: 50 },
  });
  const { data: condicionesPago = [] } = useGetList("crm/catalogos/condiciones-pago", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: motivos = [] } = useGetList("crm/catalogos/motivos-perdida", {
    pagination: { page: 1, perPage: 100 },
  });

  const ownerOptions = useMemo(
    () => [
      { value: "todos", label: "Todos", avatar: null },
      ...usuarios.map((user: any) => ({
        value: String(user.id),
        label: user.nombre ?? user.email ?? `Usuario #${user.id}`,
        avatar: user.url_foto ?? user.avatar ?? null,
      })),
    ],
    [usuarios]
  );

  // Estado para diálogo descartar
  const [descartarDialogOpen, setDescartarDialogOpen] = useState(false);
  const [descartarLoading, setDescartarLoading] = useState(false);

  // Estado para diálogo agendar
  const [agendarDialogOpen, setAgendarDialogOpen] = useState(false);
  const [agendarLoading, setAgendarLoading] = useState(false);
  const [agendarForm, setAgendarForm] = useState({
    titulo: "",
    descripcion: "",
    tipoEvento: "",
    datetime: "",
    asignadoId: "",
  });

  // Estado para diálogo cotizar
  const [cotizarDialogOpen, setCotizarDialogOpen] = useState(false);
  const [cotizarLoading, setCotizarLoading] = useState(false);
  const [cotizarForm, setCotizarForm] = useState({
    propiedadId: "",
    tipoPropiedadId: "",
    monto: "",
    monedaId: "",
    condicionPagoId: "",
    formaPagoDescripcion: "",
  });

  const { data: emprendimientos = [] } = useGetList("emprendimientos", {
    pagination: { page: 1, perPage: 500 },
  });

  // Estado para diálogo cerrar
  const [cerrarDialogOpen, setCerrarDialogOpen] = useState(false);
  const [cerrarLoading, setCerrarLoading] = useState(false);
  const [perderMotivoId, setPerderMotivoId] = useState("");
  const [perderNota, setPerderNota] = useState("");
  const [aceptarDialogOpen, setAceptarDialogOpen] = useState(false);
  const [aceptarLoading, setAceptarLoading] = useState(false);

  const [selectedOportunidad, setSelectedOportunidad] = useState<CRMOportunidad | null>(null);

  // Handler para descartar oportunidad
  const handleDescartarConfirm = useCallback(async () => {
    if (!selectedOportunidad) return;

    setDescartarLoading(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: selectedOportunidad.id,
        data: { activo: false },
        previousData: selectedOportunidad,
      });
      notify("Oportunidad descartada exitosamente", { type: "success" });
      refresh();
      setDescartarDialogOpen(false);
      setSelectedOportunidad(null);
    } catch (error: any) {
      notify(error.message || "Error al descartar la oportunidad", { type: "error" });
    } finally {
      setDescartarLoading(false);
    }
  }, [selectedOportunidad, dataProvider, notify, refresh]);

  // Handler para agendar visita
  const handleAgendarSubmit = useCallback(async () => {
    if (!selectedOportunidad) return;
    if (!agendarForm.titulo || !agendarForm.tipoEvento || !agendarForm.datetime || !agendarForm.asignadoId) {
      notify("Por favor completa todos los campos requeridos", { type: "warning" });
      return;
    }

    setAgendarLoading(true);
    try {
      // Crear evento
      await dataProvider.create("crm/eventos", {
        data: {
          titulo: agendarForm.titulo,
          descripcion: agendarForm.descripcion,
          tipo_evento_id: agendarForm.tipoEvento,
          fecha: agendarForm.datetime,
          asignado_id: agendarForm.asignadoId,
          oportunidad_id: selectedOportunidad.id,
          estado: 1, // Pendiente
        },
      });

      // Actualizar estado de oportunidad a "visita" (estado 2)
      await dataProvider.update("crm/oportunidades", {
        id: selectedOportunidad.id,
        data: { estado: 2, fecha_estado: new Date().toISOString() },
        previousData: selectedOportunidad,
      });

      notify("Visita agendada exitosamente", { type: "success" });
      refresh();
      setAgendarDialogOpen(false);
      setSelectedOportunidad(null);
      setAgendarForm({
        titulo: "",
        descripcion: "",
        tipoEvento: "",
        datetime: "",
        asignadoId: "",
      });
    } catch (error: any) {
      notify(error.message || "Error al agendar la visita", { type: "error" });
    } finally {
      setAgendarLoading(false);
    }
  }, [selectedOportunidad, agendarForm, dataProvider, notify, refresh]);

  // Handler para cotizar
  const handleCotizarSubmit = useCallback(async () => {
    if (!selectedOportunidad) return;
    if (!cotizarForm.propiedadId || !cotizarForm.monto || !cotizarForm.monedaId) {
      notify("Por favor completa todos los campos requeridos", { type: "warning" });
      return;
    }

    setCotizarLoading(true);
    try {
      // Actualizar oportunidad con datos de cotización y cambiar estado a "cotiza" (estado 3)
      await dataProvider.update("crm/oportunidades", {
        id: selectedOportunidad.id,
        data: {
          propiedad_id: cotizarForm.propiedadId,
          tipo_propiedad_id: cotizarForm.tipoPropiedadId || null,
          monto: parseFloat(cotizarForm.monto),
          moneda_id: cotizarForm.monedaId,
          condicion_pago_id: cotizarForm.condicionPagoId || null,
          forma_pago_descripcion: cotizarForm.formaPagoDescripcion || null,
          estado: 3,
          fecha_estado: new Date().toISOString(),
        },
        previousData: selectedOportunidad,
      });

      notify("Cotización registrada exitosamente", { type: "success" });
      refresh();
      setCotizarDialogOpen(false);
      setSelectedOportunidad(null);
      setCotizarForm({
        propiedadId: "",
        tipoPropiedadId: "",
        monto: "",
        monedaId: "",
        condicionPagoId: "",
        formaPagoDescripcion: "",
      });
    } catch (error: any) {
      notify(error.message || "Error al registrar la cotización", { type: "error" });
    } finally {
      setCotizarLoading(false);
    }
  }, [selectedOportunidad, cotizarForm, dataProvider, notify, refresh]);

  // Handler para cerrar como perdida
  const handleCerrarConfirm = useCallback(async () => {
    if (!selectedOportunidad) return;
    if (!perderMotivoId) {
      notify("Por favor selecciona un motivo", { type: "warning" });
      return;
    }

    setCerrarLoading(true);
    try {
      await dataProvider.update("crm/oportunidades", {
        id: selectedOportunidad.id,
        data: {
          estado: 6, // Perdida
          fecha_estado: new Date().toISOString(),
          perder_motivo_id: perderMotivoId,
          perder_nota: perderNota || null,
        },
        previousData: selectedOportunidad,
      });

      notify("Oportunidad cerrada como perdida", { type: "success" });
      refresh();
      setCerrarDialogOpen(false);
      setSelectedOportunidad(null);
      setPerderMotivoId("");
      setPerderNota("");
    } catch (error: any) {
      notify(error.message || "Error al cerrar la oportunidad", { type: "error" });
    } finally {
      setCerrarLoading(false);
    }
  }, [selectedOportunidad, perderMotivoId, perderNota, dataProvider, notify, refresh]);

  const handleAceptarOpenChange = useCallback((open: boolean) => {
    setAceptarDialogOpen(open);
    if (!open) {
      setSelectedOportunidad(null);
    }
  }, []);

  const handleAceptarSubmit = useCallback(
    async (payload: {
      titulo: string;
      tipo_operacion_id: number | null;
      tipo_propiedad_id: number | null;
      emprendimiento_id: number | null;
      descripcion_estado: string;
    }) => {
      if (!selectedOportunidad) return;
      setAceptarLoading(true);
      try {
        await dataProvider.update("crm/oportunidades", {
          id: selectedOportunidad.id,
          data: {
            ...payload,
            estado: "1-abierta",
            fecha_estado: new Date().toISOString(),
          },
          previousData: selectedOportunidad,
        });
        notify("Oportunidad confirmada y movida a Abierta", { type: "success" });
        refresh();
        handleAceptarOpenChange(false);
      } catch (error: any) {
        notify(error.message || "Error al confirmar la oportunidad", { type: "error" });
      } finally {
        setAceptarLoading(false);
      }
    },
    [selectedOportunidad, dataProvider, notify, refresh, handleAceptarOpenChange]
  );

  // Renderizado de tarjeta
  const renderCard = useCallback(
    (oportunidad: CRMOportunidad, bucketKey?: BucketKey, collapsed?: boolean, onToggleCollapse?: () => void) => (
      <CRMOportunidadKanbanCard
        key={oportunidad.id}
        oportunidad={oportunidad}
        bucketKey={bucketKey}
        collapsed={collapsed}
        updating={false}
        onToggleCollapse={onToggleCollapse}
        onEdit={(opp) => {
          navigate(`/crm/oportunidades/${opp.id}`, { state: { fromPanel: true } });
        }}
        onAceptar={(opp) => {
          setSelectedOportunidad(opp);
          setAceptarDialogOpen(true);
        }}
        onAgendar={(opp) => {
          setSelectedOportunidad(opp);
          setAgendarForm({
            titulo: `Visita ${opp.titulo || ""}`,
            descripcion: "",
            tipoEvento: tiposEvento[0]?.id?.toString() || "",
            datetime: "",
            asignadoId: identity?.id?.toString() || "",
          });
          setAgendarDialogOpen(true);
        }}
        onCotizar={(opp) => {
          setSelectedOportunidad(opp);
          setCotizarForm({
            propiedadId: opp.propiedad_id?.toString() || "",
            tipoPropiedadId: "",
            monto: opp.monto?.toString() || "",
            monedaId: opp.moneda_id?.toString() || monedas[0]?.id?.toString() || "",
            condicionPagoId: "",
            formaPagoDescripcion: "",
          });
          setCotizarDialogOpen(true);
        }}
        onCerrar={(opp) => {
          setSelectedOportunidad(opp);
          setPerderMotivoId("");
          setPerderNota("");
          setCerrarDialogOpen(true);
        }}
        onDescartar={(opp) => {
          setSelectedOportunidad(opp);
          setDescartarDialogOpen(true);
        }}
      />
    ),
    [tiposEvento, identity, monedas, navigate]
  );

  // Definición de buckets
  const buckets = useMemo(() => getBuckets(), []);

  return (
    <>
      <KanbanBoardView<CRMOportunidad, BucketKey>
        items={oportunidades}
        buckets={buckets}
        getBucketKey={calculateOportunidadBucketKey}
        maxBucketsPerPage={4}
        bucketGridClassName="gap-2 md:gap-3 xl:gap-3"
        onItemMove={prepareMoveOportunidadPayload}
        resource="crm/oportunidades"
        getMoveSuccessMessage={(oportunidad, bucket) => `Oportunidad movida a ${getBucketLabel(bucket)}`}
        searchFilter={searchFilterFn}
        ownerFilter={ownerFilterFn}
        autoSelectOwnerId={identity?.id ? String(identity.id) : undefined}
        identity={identity}
        filterConfig={{
          enableSearch: true,
          searchPlaceholder: "Buscar oportunidades...",
          searchClassName: "w-[60vw] max-w-none min-w-0 sm:flex-1 sm:min-w-[200px] sm:max-w-md",
          searchInputClassName: "!h-5 !py-0 !text-[9px] sm:!h-9 sm:!text-sm",
          enableOwnerFilter: true,
          ownerFilterPlaceholder: "Responsable",
          ownerFilterClassName: "w-[35vw] min-w-0 sm:min-w-[170px]",
          ownerTriggerClassName: "!h-5 !py-0 !text-[9px] sm:!h-9 sm:!text-sm !px-2",
          ownerHideLabel: true,
          ownerHideLabelOnSmall: true,
          ownerFilterPlacement: "left",
          ownerOptions,
          enableCollapseToggle: true,
        }}
        customFilters={() => <OportunidadCustomFilters />}
        renderCard={renderCard}
        isLoading={isLoading}
        loadingMessage="Cargando oportunidades..."
        emptyMessage="Sin oportunidades"
        noResultsMessage="No se encontraron oportunidades con los filtros aplicados"
      />

      {/* Diálogo de descartar */}
      <CRMOportunidadDescartarDialog
        open={descartarDialogOpen}
        onOpenChange={setDescartarDialogOpen}
        onConfirm={handleDescartarConfirm}
        disabled={descartarLoading}
      />

      {/* Diálogo de agendar */}
      <CRMOportunidadAgendarDialog
        open={agendarDialogOpen}
        onOpenChange={setAgendarDialogOpen}
        formValues={agendarForm}
        onFormChange={setAgendarForm}
        tipoEventoOptions={tiposEvento.map((t: any) => ({ value: t.id.toString(), label: t.nombre }))}
        responsableOptions={usuarios.map((u: any) => ({ value: u.id.toString(), label: u.nombre }))}
        onSubmit={handleAgendarSubmit}
        disabled={agendarLoading}
      />

      {/* Diálogo de cotizar */}
      <CRMOportunidadCotizarDialog
        open={cotizarDialogOpen}
        onOpenChange={setCotizarDialogOpen}
        formValues={cotizarForm}
        onFormChange={setCotizarForm}
        propiedades={propiedades.map((p: any) => ({ value: p.id.toString(), label: p.nombre }))}
        tiposPropiedad={tiposPropiedad.map((t: any) => ({ value: t.id.toString(), label: t.nombre }))}
        monedas={monedas.map((m: any) => ({ value: m.id.toString(), label: m.nombre }))}
        condicionesPago={condicionesPago.map((c: any) => ({ value: c.id.toString(), label: c.nombre }))}
        onSubmit={handleCotizarSubmit}
        disabled={cotizarLoading}
      />

      {/* Diálogo de cerrar como perdida */}
      <CRMOportunidadCerrarDialog
        open={cerrarDialogOpen}
        onOpenChange={setCerrarDialogOpen}
        motivoOptions={motivos.map((m: any) => ({ value: m.id.toString(), label: m.nombre }))}
        perderMotivoId={perderMotivoId}
        onPerderMotivoChange={setPerderMotivoId}
        perderNota={perderNota}
        onPerderNotaChange={setPerderNota}
        onConfirm={handleCerrarConfirm}
        disabled={cerrarLoading}
      />

      {/* Diálogo de confirmar prospecto */}
      {selectedOportunidad && (
        <CRMOportunidadAceptarDialog
          open={aceptarDialogOpen}
          onOpenChange={handleAceptarOpenChange}
          record={selectedOportunidad}
          onComplete={handleAceptarSubmit}
          isProcessing={aceptarLoading}
          tipoPropiedadOptions={tiposPropiedad}
          emprendimientoOptions={emprendimientos}
        />
      )}
    </>
  );
};

export const CRMOportunidadListKanban = () => {
  return (
    <List
      resource="crm/oportunidades"
      title={<ResourceTitle icon={Target} text="CRM - Oportunidades (Kanban)" />}
      showBreadcrumb={false}
      filters={filters}
      actions={<ListActions />}
      perPage={500}
      pagination={false}
      sort={{ field: "fecha_estado", order: "DESC" }}
      className="space-y-5"
    >
      <OportunidadListContent />
    </List>
  );
};

// Alias para compatibilidad con rutas
export const CRMOportunidadPanelPage = CRMOportunidadListKanban;

export default CRMOportunidadListKanban;
