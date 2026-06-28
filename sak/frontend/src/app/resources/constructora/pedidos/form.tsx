"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  required,
  useDataProvider,
  useGetOne,
  useNotify,
  useRecordContext,
  useRefresh,
  useWrappedSource,
} from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ReferenceInput } from "@/components/reference-input";
import { SimpleForm } from "@/components/simple-form";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Confirm } from "@/components/confirm";
import {
  DetailFieldCell,
  FormErrorSummary,
  FORM_FIELD_READONLY_CLASS,
  FormNumber,
  FormOrderCancelButton,
  FormOrderHeaderMenuActions,
  FormOrderSaveButton,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormValue,
  handleFormTabLoop,
  HiddenInput,
  SectionBaseTemplate,
  SectionDetailColumn,
  SectionDetailFieldsProps,
  SectionDetailTemplate2,
  useIdentityId,
} from "@/components/forms/form_order";
import { cn } from "@/lib/utils";
import {
  getPedidoDetalleDefaults,
  PEDIDO_DEFAULTS,
  pedidoSchema,
  type PedidoFormValues,
} from "./model";
import {
  useAccionesCabeceraPedido,
  usePedidoReadOnly,
} from "./form_hooks";
import {
  PEDIDO_ESTADO_ACTIONS,
  PEDIDO_STATUS_CONFIRM_OVERLAY_CLASS,
  PedidoEstadoMenuItems,
  patchPedidoEstado,
  type PedidoEstadoAction,
} from "./status-actions";

const PedidoDetailEditContext = createContext<{
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
} | null>(null);

const usePedidoDetailEdit = () => useContext(PedidoDetailEditContext);

export const PedidoForm = () => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <PedidoDetailEditContext.Provider
      value={{
        isEditing,
        setIsEditing,
      }}
    >
      <div onKeyDown={handleFormTabLoop}>
        <SimpleForm<PedidoFormValues>
          className="w-full max-w-3xl"
          resolver={zodResolver(pedidoSchema) as any}
          toolbar={<PedidoToolbar />}
          defaultValues={PEDIDO_DEFAULTS}
        >
          <PedidoContenido />
        </SimpleForm>
      </div>
    </PedidoDetailEditContext.Provider>
  );
};

const PedidoToolbar = () => {
  const editContext = usePedidoDetailEdit();
  const isReadOnly = usePedidoReadOnly();

  return (
    <div className="flex w-full items-center justify-end gap-2">
      <FormOrderCancelButton />
      <FormOrderSaveButton
        variant="secondary"
        disabled={isReadOnly || (editContext?.isEditing ?? false)}
      />
    </div>
  );
};

const PedidoContenido = () => (
  <>
    <PedidoDefaultsSync />
    <FormErrorSummary />
    <CabeceraPedido />
    <DetallePedido />
  </>
);

const PedidoDefaultsSync = () => {
  const record = useRecordContext<PedidoFormValues & { id?: number | string }>();
  const { identityId } = useIdentityId();
  const { setValue } = useFormContext<PedidoFormValues>();
  const solicitanteId = useWatch({ name: "solicitante_id" });
  const responsableRevisionId = useWatch({ name: "responsable_revision_id" });

  useEffect(() => {
    if (record?.id || !identityId || solicitanteId) return;
    setValue("solicitante_id", identityId, { shouldDirty: false });
  }, [identityId, record?.id, solicitanteId, setValue]);

  useEffect(() => {
    if (record?.id || !identityId || responsableRevisionId) return;
    setValue("responsable_revision_id", identityId, { shouldDirty: false });
  }, [identityId, record?.id, responsableRevisionId, setValue]);

  return null;
};

const CabeceraPedido = () => {
  const {
    canPreview,
    onPreview,
  } = useAccionesCabeceraPedido();
  const notify = useNotify();
  const refresh = useRefresh();
  const isReadOnly = usePedidoReadOnly();
  const record = useRecordContext<PedidoFormValues & { id?: number | string; estado?: string | null }>();
  const [pendingEstadoAction, setPendingEstadoAction] = useState<PedidoEstadoAction | null>(null);
  const [estadoLoading, setEstadoLoading] = useState(false);
  const canChangeEstado = Boolean(record?.id) && !isReadOnly;
  const pendingEstadoConfig = pendingEstadoAction
    ? PEDIDO_ESTADO_ACTIONS[pendingEstadoAction]
    : null;

  const runEstadoAction = async () => {
    if (!record?.id || !pendingEstadoAction) return;
    setEstadoLoading(true);
    try {
      await patchPedidoEstado(record.id, PEDIDO_ESTADO_ACTIONS[pendingEstadoAction].estado);
      notify("Pedido actualizado", { type: "success" });
      refresh();
      setPendingEstadoAction(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar el pedido", {
        type: "error",
      });
    } finally {
      setEstadoLoading(false);
    }
  };

  const actionsMenu =
    canChangeEstado || canPreview ? (
      <>
        <FormOrderHeaderMenuActions
          canPreview={canPreview}
          canDelete={false}
          onPreview={onPreview}
          previewLabel="Visualizar"
        />
        {canChangeEstado && canPreview ? <DropdownMenuSeparator /> : null}
        {canChangeEstado ? (
          <PedidoEstadoMenuItems
            disabled={isReadOnly || estadoLoading}
            onRequestAction={setPendingEstadoAction}
          />
        ) : null}
      </>
    ) : null;

  return (
    <>
      <SectionBaseTemplate
        title="Cabecera"
        readOnly={isReadOnly}
        main={({ showOptional, toggleOptional }) => (
          <>
            <CabeceraCamposPrincipales
              showOptional={showOptional}
              toggleOptional={toggleOptional}
            />
            <HiddenInput source="estado" />
            <HiddenInput source="mensaje_origen_id" />
            <HiddenInput source="origen" />
            <HiddenInput source="solicitante_id" />
          </>
        )}
        actions={actionsMenu}
        optional={<CabeceraCamposOpcionales />}
        showCollapseToggle={false}
        optionalTogglePlacement="none"
      />
      {pendingEstadoConfig ? (
        <Confirm
          isOpen={Boolean(pendingEstadoAction)}
          onClose={() => setPendingEstadoAction(null)}
          onConfirm={runEstadoAction}
          title={pendingEstadoConfig.title}
          content={pendingEstadoConfig.content}
          confirm={pendingEstadoConfig.label}
          confirmColor={pendingEstadoConfig.confirmColor}
          overlayClassName={PEDIDO_STATUS_CONFIRM_OVERLAY_CLASS}
          loading={estadoLoading}
        />
      ) : null}
    </>
  );
};

const CabeceraCamposPrincipales = ({
  showOptional,
  toggleOptional,
}: {
  showOptional: boolean;
  toggleOptional: () => void;
}) => {
  const isReadOnly = usePedidoReadOnly();
  const ToggleIcon = showOptional ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <FormText
          source="titulo"
          label="Titulo"
          validate={required()}
          autoFocus
          widthClass="w-full md:w-[260px]"
          readOnly={isReadOnly}
        />
        <div className="w-full md:w-[240px]">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "oportunidad_id",
              reference: "crm/oportunidades",
            }}
            inputProps={{
              optionText: "titulo",
              label: "Oportunidad",
              validate: required(),
            }}
            widthClass="w-full"
            className={isReadOnly ? FORM_FIELD_READONLY_CLASS : undefined}
          />
        </div>
        <div className="w-full md:w-[220px]">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "contacto_id",
              reference: "crm/contactos",
            }}
            inputProps={{
              optionText: "nombre_completo",
              label: "Contacto",
              placeholder: "Seleccionar",
            }}
            widthClass="w-full"
            className={isReadOnly ? FORM_FIELD_READONLY_CLASS : undefined}
          />
        </div>
        <div className="flex h-5 items-center justify-center md:self-end">
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              toggleOptional();
            }}
            aria-label={showOptional ? "Ocultar campos optativos" : "Mostrar campos optativos"}
            title={showOptional ? "Ocultar campos optativos" : "Mostrar campos optativos"}
            tabIndex={-1}
          >
            <ToggleIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CabeceraCamposOpcionales = () => {
  const isReadOnly = usePedidoReadOnly();

  return (
    <div className="mt-1 space-y-0">
      <div className="rounded-md border border-muted/60 bg-muted/30 p-2">
        <div className="grid gap-2 md:grid-cols-2">
          <FormReferenceAutocomplete
            referenceProps={{
              source: "responsable_revision_id",
              reference: "users",
            }}
            inputProps={{
              optionText: "nombre",
              label: "Responsable revision",
            }}
            widthClass="w-full"
            className={isReadOnly ? FORM_FIELD_READONLY_CLASS : undefined}
          />
          <FormText
            source="observaciones"
            label="Observaciones"
            widthClass="w-full"
            readOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
};

const DetallePedido = () => {
  const editContext = usePedidoDetailEdit();
  const handleActiveRowChange = useMemo(
    () => (index: number | null) => {
      editContext?.setIsEditing(index != null);
    },
    [editContext],
  );
  const isReadOnly = usePedidoReadOnly();

  const columns: SectionDetailColumn[] = [
    { label: "Articulo", width: "180px", mobileSpan: "full" },
    { label: "Descripcion", width: "220px", mobileSpan: "full" },
    { label: "Cantidad", width: "64px", className: "-ml-[10px]" },
    { label: "Unidad", width: "72px" },
    { label: "", width: "minmax(64px,1fr)" },
  ];

  const DetalleCamposPrincipales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <>
        <PedidoDetalleTipoSolicitudSync />
        <HiddenInput source="orden" />
        <HiddenInput source="descripcion_original" />
        <HiddenInput source="estado" />
        <HiddenInput source="origen" />
        <HiddenInput source="cantidad_original" />
        <HiddenInput source="po_order_id" />
        <HiddenInput source="po_order_detail_id" />
        <DetailFieldCell
          label="Articulo"
          data-articulo-field="true"
          data-focus-field="true"
        >
          <FormReferenceAutocomplete
            referenceProps={{
              source: "articulo_id",
              reference: "articulos",
            }}
            inputProps={{
              optionText: "nombre",
              label: false,
            }}
            widthClass="w-full"
            className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Descripcion">
          <FormText
            source="descripcion"
            label={false}
            widthClass="w-full"
            readOnly={!isActive}
            className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Cant." className="gap-0">
          <FormNumber
            source="cantidad"
            label={false}
            inputMode="decimal"
            step="0.001"
            widthClass="w-full"
            validate={required()}
            readOnly={!isActive}
            className={cn(
              "gap-0 [&_input]:h-4.5 [&_input]:px-1 sm:[&_input]:h-5 sm:[&_input]:px-2",
              !isActive ? FORM_FIELD_READONLY_CLASS : undefined,
            )}
          />
        </DetailFieldCell>
        <DetailFieldCell label="Unidad" className="gap-0">
          <FormText
            source="unidad_medida"
            label={false}
            widthClass="w-full"
            readOnly={!isActive}
            className={cn(!isActive && FORM_FIELD_READONLY_CLASS)}
          />
        </DetailFieldCell>
      </>
    ),
    [],
  );

  const DetalleCamposOpcionales = useCallback(
    ({ isActive }: SectionDetailFieldsProps) => (
      <div className="w-full">
        <div className="mt-0 rounded-md border border-muted/60 bg-muted/30 p-2">
          <div className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-[180px_220px_64px] md:justify-start">
              <ReferenceInput source="tipo_solicitud_id" reference="tipos-solicitud">
                <FormSelect
                  optionText="nombre"
                  label="Tipo solicitud"
                  widthClass="w-full sm:w-[180px]"
                  className={!isActive ? FORM_FIELD_READONLY_CLASS : undefined}
                />
              </ReferenceInput>
              <DetalleOriginalAgenteValue />
              <DetalleCantidadOriginalValue />
            </div>
            <div className="grid gap-2 md:grid-cols-[210px_90px_120px] md:justify-start">
              <DetalleCentroCostoValue />
              <FormValue label="PO" widthClass="w-full">
                <PoGeneradaValue />
              </FormValue>
              <DetalleOrigenValue />
            </div>
          </div>
        </div>
      </div>
    ),
    [],
  );

  return (
    <SectionDetailTemplate2
      title="Detalle"
      mainColumns={columns}
      mainFields={DetalleCamposPrincipales}
      optionalFields={DetalleCamposOpcionales}
      defaults={getPedidoDetalleDefaults}
      maxHeightClassName="md:max-h-48"
      onActiveRowChange={handleActiveRowChange}
      readOnly={isReadOnly}
      showInfoWhenInactive
      showInfoAction={false}
      showDeleteWhenInactive
      saveOnlyWhenActive
      showExpandActionOnMobile
      showExpandAction
      canDeleteRow={(row) => String(row.origen ?? "").trim().toLowerCase() !== "agente"}
      detailIteratorClassName="[&_li]:!border-b [&_li]:!border-slate-200/70 [&_li:last-child]:!border-b-0"
    />
  );
};

const PedidoDetalleTipoSolicitudSync = () => {
  useSyncTipoSolicitudFromArticulo();
  return null;
};

const DetalleOrigenValue = () => {
  const origenSource = useWrappedSource("origen");
  const origen = useWatch({ name: origenSource }) as string | undefined;
  const origenLabel =
    String(origen ?? "").trim().toLowerCase() === "agente" ? "Agente" : "Manual";

  return (
    <FormValue label="Tipo" widthClass="w-full" valueClassName="justify-start text-left">
      {origenLabel}
    </FormValue>
  );
};

const DetalleCantidadOriginalValue = () => {
  const cantidadOriginalSource = useWrappedSource("cantidad_original");
  const cantidadOriginal = useWatch({ name: cantidadOriginalSource }) as string | number | undefined;
  const cantidadOriginalLabel =
    cantidadOriginal === undefined || cantidadOriginal === null || cantidadOriginal === ""
      ? "-"
      : String(cantidadOriginal);

  return (
    <FormValue
      label="C.Original"
      widthClass="w-full sm:w-[64px]"
      valueClassName="justify-start text-left"
    >
      {cantidadOriginalLabel}
    </FormValue>
  );
};

const DetalleCentroCostoValue = () => {
  const centroCostoSource = useWrappedSource("centro_costo_id");
  const centroCostoId = useWatch({ name: centroCostoSource }) as string | number | undefined;
  const { data } = useGetOne(
    "centros-costo",
    { id: centroCostoId as string | number },
    { enabled: Boolean(centroCostoId) },
  );

  return (
    <FormValue label="Centro de costo" widthClass="w-full" valueClassName="justify-start text-left">
      {data?.nombre ?? (centroCostoId ? `#${centroCostoId}` : "-")}
    </FormValue>
  );
};

const DetalleOriginalAgenteValue = () => {
  const descripcionOriginalSource = useWrappedSource("descripcion_original");
  const descripcionOriginal = useWatch({ name: descripcionOriginalSource }) as string | undefined;

  return (
    <FormValue
      label="Descripcion original"
      widthClass="w-full sm:w-[220px]"
      valueClassName="justify-start text-left"
    >
      {descripcionOriginal?.trim() || "-"}
    </FormValue>
  );
};

const PoGeneradaValue = () => {
  const poOrderIdSource = useWrappedSource("po_order_id");
  const poOrderDetailIdSource = useWrappedSource("po_order_detail_id");
  const poOrderId = useWatch({ name: poOrderIdSource }) as string | number | undefined;
  const poOrderDetailId = useWatch({ name: poOrderDetailIdSource }) as string | number | undefined;

  if (!poOrderId) return <>-</>;
  return (
    <>
      #{poOrderId}
      {poOrderDetailId ? ` / linea #${poOrderDetailId}` : ""}
    </>
  );
};

const resolvePositiveId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const useSyncTipoSolicitudFromArticulo = () => {
  const dataProvider = useDataProvider();
  const { getValues, setValue } = useFormContext<PedidoFormValues>();
  const articuloSource = useWrappedSource("articulo_id");
  const tipoSolicitudSource = useWrappedSource("tipo_solicitud_id");
  const articuloId = useWatch({ name: articuloSource }) as unknown;
  const prevArticuloIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const resolvedArticuloId = resolvePositiveId(articuloId);
    if (!resolvedArticuloId) {
      prevArticuloIdRef.current = undefined;
      return;
    }
    if (prevArticuloIdRef.current === resolvedArticuloId) return;
    const articuloChanged = prevArticuloIdRef.current != null;
    prevArticuloIdRef.current = resolvedArticuloId;

    let active = true;
    (async () => {
      try {
        const { data: articulo } = await dataProvider.getOne("articulos", {
          id: resolvedArticuloId,
        });
        if (!active) return;

        const tipoArticuloId = resolvePositiveId(
          (articulo as { tipo_articulo_id?: unknown } | undefined)?.tipo_articulo_id,
        );
        if (!tipoArticuloId) return;

        const { data: tiposSolicitud } = await dataProvider.getList("tipos-solicitud", {
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
          filter: { tipo_articulo_filter_id: tipoArticuloId, activo: true },
        });
        if (!active) return;

        const tipoSolicitudId = resolvePositiveId(tiposSolicitud?.[0]?.id);
        if (!tipoSolicitudId) return;

        const currentTipoSolicitudId = resolvePositiveId(getValues(tipoSolicitudSource as any));
        if (currentTipoSolicitudId === tipoSolicitudId) return;
        if (!articuloChanged && currentTipoSolicitudId) return;

        setValue(tipoSolicitudSource as any, tipoSolicitudId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      active = false;
    };
  }, [articuloId, dataProvider, getValues, setValue, tipoSolicitudSource]);
};
