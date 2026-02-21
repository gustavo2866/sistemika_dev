"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGetList, useListContext, useRecordContext } from "ra-core";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  FormOrderListRowActions,
  ListColumn,
  ListDate,
  ListEstado,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  ListPaginator,
  useRowActionDialog,
} from "@/components/forms/form_order";
import { List } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FormProvider, useForm } from "react-hook-form";

import { PROPIEDAD_STATUS_BADGES, type Propiedad } from "./model";
import { PropiedadesDashboard } from "./dashboard";
import { FormStatus, FormStatusContent, type FormStatusValues } from "./form_status";
import { getAllowedPropiedadStatusTargets } from "./status_transitions";
import { usePropiedadStatusTransition } from "./form_hooks";


// === Filtros ===
const LIST_FILTERS = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar",
        alwaysOn: true,
        className: "w-[120px] sm:w-[160px]",
      },
    },
    {
      type: "text",
      props: {
        source: "propietario",
        label: "Propietario",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_operacion_id",
        reference: "crm/catalogos/tipos-operacion",
        label: "Tipo operacion",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        className: "w-full",
        disabled: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "propiedad_status_id",
        reference: "propiedades-status",
        label: "Estado",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "emprendimiento_id",
        reference: "emprendimientos",
        label: "Emprendimiento",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
        className: "w-full",
      },
    },
  ],
  { keyPrefix: "propiedades-inmobiliaria" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

const AccionesLista = () => (
  <div className="flex items-center gap-2">
    <FilterButton
      filters={LIST_FILTERS}
      size="sm"
      buttonClassName={ACTION_BUTTON_CLASS}
    />
    <CreateButton className={ACTION_BUTTON_CLASS} label="Crear" />
    <ExportButton className={ACTION_BUTTON_CLASS} label="Exportar" />
  </div>
);


// === Listado ===
export const PropiedadList = () => <ListaPropiedades />;

const ListaPropiedades = () => (
  <List
    title="Propiedades"
    filters={LIST_FILTERS}
    actions={<AccionesLista />}
    topContent={<PropiedadesDashboardEmbedded />}
    debounce={300}
    perPage={10}
    containerClassName="max-w-[980px] w-full mr-auto"
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <AlquilerFilterLock />
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: [
          "propietario",
          "propiedad_status_id",
          "valor_alquiler",
        ],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" />
      </ListColumn>
      <ListColumn source="nombre" label="Nombre" className="w-[150px]">
        <div className="flex flex-col gap-0.5">
          <ListText source="nombre" className="font-medium" />
          <ListText source="propietario" className="text-[9px] text-muted-foreground" />
        </div>
      </ListColumn>
      <ListColumn source="tipo_propiedad_id" label="Tipo prop." className="w-[110px]">
        <ReferenceField
          source="tipo_propiedad_id"
          reference="tipos-propiedad"
          link={false}
          emptyText="Sin asignar"
        >
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="tipo_operacion_id" label="Operacion" className="w-[90px]">
        <ReferenceField
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          link={false}
          emptyText="Sin asignar"
        >
          <ListText source="nombre" />
        </ReferenceField>
      </ListColumn>
      <ListColumn source="propiedad_status_id" label="Estado" className="w-[90px]">
        <ListEstado
          source="propiedad_status.nombre"
          statusClasses={PROPIEDAD_STATUS_BADGES}
        />
      </ListColumn>
      <ListColumn source="estado_fecha" label="Fecha Est" className="w-[80px]">
        <ListDate source="estado_fecha" />
      </ListColumn>
      <ListColumn source="vencimiento_contrato" label="Fecha Cont" className="w-[90px]">
        <ListDate source="vencimiento_contrato" />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <FormOrderListRowActions
          showShow={false}
          showDelete
          extraMenuItems={<PropiedadStatusMenu />}
        />
      </ListColumn>
    </ResponsiveDataTable>
  </List>
);

const PropiedadStatusMenu = () => {
  const record = useRecordContext<Propiedad>();
  const dialog = useRowActionDialog();
  const { cambiarEstado, loading } = usePropiedadStatusTransition();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const form = useForm<FormStatusValues>({
    defaultValues: { fecha_cambio: today, comentario: "" },
    mode: "onChange",
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nextStatusId, setNextStatusId] = useState<number | null>(null);

  const allowedTargets = useMemo(
    () => getAllowedPropiedadStatusTargets(record?.propiedad_status_id ?? null),
    [record?.propiedad_status_id],
  );

  if (!record?.id || allowedTargets.length === 0) return null;

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setNextStatusId(null);
  };

  const handleDialogConfirm = (statusId: number) =>
    form.handleSubmit(async (values) => {
      if (loading) return;
      await cambiarEstado({
        record,
        nextStatusId: statusId,
        fechaCambio: values.fecha_cambio,
        comentario: values.comentario,
      });
    })();

  const openDialogWithForm = (statusId: number) => {
    form.reset({ fecha_cambio: today, comentario: "" });
    if (dialog) {
      dialog.openDialog({
        title: "Cambiar estado",
        contentClassName: "sm:max-w-[420px]",
        content: (
          <FormProvider {...form}>
            <FormStatusContent record={record} nextStatusId={statusId} />
          </FormProvider>
        ),
        confirmLabel: "Confirmar",
        confirmColor: "primary",
        onConfirm: () => handleDialogConfirm(statusId),
      });
      return;
    }
    setNextStatusId(statusId);
    setDialogOpen(true);
  };

  const handleOpenDialog = (
    event: { stopPropagation: () => void },
    statusId: number,
  ) => {
    event.stopPropagation();
    openDialogWithForm(statusId);
  };

  return (
    <>
      {allowedTargets.map((option) => (
        <DropdownMenuItem
          key={option.key}
          onSelect={(event) => handleOpenDialog(event, option.id)}
          onClick={(event) => event.stopPropagation()}
          data-row-click="ignore"
          className="px-1.5 py-1 text-[8px] sm:text-[10px]"
        >
          {option.label}
        </DropdownMenuItem>
      ))}
      {nextStatusId != null ? (
        <FormStatus
          open={dialogOpen}
          onOpenChange={handleOpenChange}
          record={record}
          nextStatusId={nextStatusId}
        />
      ) : null}
    </>
  );
};

const AlquilerFilterLock = () => {
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { filterValues, setFilters } = useListContext();
  const appliedRef = useRef(false);
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);

  useEffect(() => {
    if (!alquilerId) {
      return;
    }
    if (appliedRef.current && filterValues.tipo_operacion_id === alquilerId) {
      return;
    }
    setFilters({ ...filterValues, tipo_operacion_id: alquilerId }, {});
    appliedRef.current = true;
  }, [alquilerId, filterValues, setFilters]);

  return null;
};

const PropiedadesDashboardEmbedded = () => {
  const { filterValues, setFilters } = useListContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: estados = [] } = useGetList("propiedades-status", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "orden", order: "ASC" },
  });

  const normalizeEstado = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getEstadoKeyFromNombre = (estado: string) => {
    const key = normalizeEstado(estado);
    if (key.includes("recibida")) return "recibida";
    if (key.includes("reparacion")) return "en_reparacion";
    if (key.includes("disponible")) return "disponible";
    if (key.includes("realizada")) return "realizada";
    if (key.includes("retirada")) return "retirada";
    return undefined;
  };

  const estadoMap = useMemo(() => {
    const map = new Map<string, string>();
    estados.forEach((estado: any) => {
      if (!estado?.nombre || estado?.id == null) return;
      map.set(normalizeEstado(String(estado.nombre)), String(estado.id));
    });
    return map;
  }, [estados]);

  const getEstadoId = (estadoKey: string) => {
    const normalizedKey = normalizeEstado(estadoKey);
    for (const [name, id] of estadoMap.entries()) {
      if (name.includes(normalizedKey)) {
        return id;
      }
    }
    return undefined;
  };

  const selectedEstadoKey = useMemo(() => {
    const selectedId = filterValues.propiedad_status_id;
    if (!selectedId) return undefined;
    const estado = estados.find((item: any) => String(item?.id) === String(selectedId));
    if (!estado?.nombre) return undefined;
    return getEstadoKeyFromNombre(String(estado.nombre));
  }, [filterValues.propiedad_status_id, estados]);

  const formatDate = (value: Date) => value.toISOString().slice(0, 10);
  const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const getSelectedBucketKey = () => {
    const today = new Date();
    const plus30 = formatDate(addDays(today, 30));
    const plus60 = formatDate(addDays(today, 60));
    const minus30 = formatDate(addDays(today, -30));

    const vencLt = filterValues.vencimiento_contrato__lt;
    const vencGte = filterValues.vencimiento_contrato__gte;
    if (vencLt === plus30 && !vencGte) return "lt_30";
    if (vencLt === plus60 && vencGte === plus30) return "lt_60";

    const estadoGte = filterValues.estado_fecha__gte;
    const estadoLt = filterValues.estado_fecha__lt;
    if (estadoGte === minus30) return "lt_30";
    if (estadoLt === minus30) return "gt_30";

    return undefined;
  };

  const selectedBucketKey = useMemo(
    () => getSelectedBucketKey(),
    [filterValues],
  );

  const clearRangeFilters = (filters: Record<string, any>) => {
    const next = { ...filters };
    [
      "vencimiento_contrato__lt",
      "vencimiento_contrato__lte",
      "vencimiento_contrato__gt",
      "vencimiento_contrato__gte",
      "estado_fecha__lt",
      "estado_fecha__lte",
      "estado_fecha__gt",
      "estado_fecha__gte",
    ].forEach((key) => {
      if (key in next) delete next[key];
    });
    return next;
  };

  const clearEstadoFilter = () => {
    const next = clearRangeFilters({ ...filterValues });
    if ("propiedad_status_id" in next) {
      delete next.propiedad_status_id;
    }
    setFilters(next, {});
  };

  const applyEstadoFilter = (estadoKey: string, extra: Record<string, any> = {}) => {
    const estadoId = getEstadoId(estadoKey);
    if (!estadoId) return;
    const next = clearRangeFilters({ ...filterValues });
    Object.assign(next, extra);
    next.propiedad_status_id = estadoId;
    setFilters(next, {});
  };

  const handleCardClick = (payload: { estadoKey: string }) => {
    if (selectedEstadoKey === payload.estadoKey && !selectedBucketKey) {
      clearEstadoFilter();
      return;
    }
    applyEstadoFilter(payload.estadoKey);
  };

  const handleBucketClick = (payload: { estadoKey: string; bucketKey: string }) => {
    if (
      selectedEstadoKey === payload.estadoKey &&
      selectedBucketKey === payload.bucketKey
    ) {
      clearEstadoFilter();
      return;
    }
    const today = new Date();
    if (payload.estadoKey === "realizada") {
      if (payload.bucketKey === "lt_30") {
        applyEstadoFilter(payload.estadoKey, {
          vencimiento_contrato__lt: formatDate(addDays(today, 30)),
        });
        return;
      }
      if (payload.bucketKey === "lt_60") {
        applyEstadoFilter(payload.estadoKey, {
          vencimiento_contrato__gte: formatDate(addDays(today, 30)),
          vencimiento_contrato__lt: formatDate(addDays(today, 60)),
        });
        return;
      }
    }
    if (payload.estadoKey === "retirada") {
      if (payload.bucketKey === "lt_30") {
        applyEstadoFilter(payload.estadoKey, {
          estado_fecha__gte: formatDate(addDays(today, -30)),
        });
        return;
      }
      if (payload.bucketKey === "gt_30") {
        applyEstadoFilter(payload.estadoKey, {
          estado_fecha__lt: formatDate(addDays(today, -30)),
        });
        return;
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener("propiedades-dashboard-refresh", handler);
    return () => {
      window.removeEventListener("propiedades-dashboard-refresh", handler);
    };
  }, []);

  return (
    <div className="mb-4">
      <PropiedadesDashboard
        tipoOperacionId={String(filterValues.tipo_operacion_id ?? "")}
        onCardClick={handleCardClick}
        onBucketClick={handleBucketClick}
        selectedEstadoKey={selectedEstadoKey}
        selectedBucketKey={selectedBucketKey}
        refreshKey={refreshKey}
      />
    </div>
  );
};
