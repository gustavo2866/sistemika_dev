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
import { Target } from "lucide-react";
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

// Definición de buckets (usando todos los estados)
const getBuckets = () => {
  return CRM_OPORTUNIDAD_ESTADOS.map((estado) => ({
    key: estado as BucketKey,
    title: getBucketLabel(estado),
    helper: "",
    accentClass: ESTADO_BG_COLORS[estado] ?? "from-white/95 to-slate-50/70",
  }));
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
    <CreateButton />
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

  // Estado para diálogo cerrar
  const [cerrarDialogOpen, setCerrarDialogOpen] = useState(false);
  const [cerrarLoading, setCerrarLoading] = useState(false);
  const [perderMotivoId, setPerderMotivoId] = useState("");
  const [perderNota, setPerderNota] = useState("");

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
          navigate(`/crm/oportunidades/${opp.id}`);
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
    [tiposEvento, identity, monedas]
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
        onItemMove={prepareMoveOportunidadPayload}
        resource="crm/oportunidades"
        getMoveSuccessMessage={(oportunidad, bucket) => `Oportunidad movida a ${getBucketLabel(bucket)}`}
        searchFilter={searchFilterFn}
        ownerFilter={ownerFilterFn}
        autoSelectOwnerId={identity?.id ? String(identity.id) : undefined}
        filterConfig={{
          enableSearch: true,
          searchPlaceholder: "Buscar oportunidades...",
          enableOwnerFilter: true,
          ownerFilterPlaceholder: "Responsable",
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
