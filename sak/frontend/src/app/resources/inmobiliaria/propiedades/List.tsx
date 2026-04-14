"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { Pencil } from "lucide-react";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { FilterButton } from "@/components/filter-form";
import {
  FormOrderBulkActionsToolbar,
  ListColumn,
  ListDate,
  ListEstado,
  ListText,
  ResponsiveDataTable,
  buildListFilters,
  ListPaginator,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { List, LIST_CONTAINER_WIDE } from "@/components/list";
import { ReferenceField } from "@/components/reference-field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "react-router-dom";

import {
  PROPIEDAD_STATUS_BADGES,
  excludeMantenimientoTipoOperacion,
} from "./model";
import type { Propiedad } from "./model";
import { PropiedadRowActions } from "./row-actions";


// === Filtros ===
export const LIST_FILTERS = buildListFilters(
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
        source: "nombre",
        label: "Nombre",
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
        disabled: false,
        choicesFilter: excludeMantenimientoTipoOperacion,
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
  { keyPrefix: "propiedades" },
);

// === Acciones ===
const ACTION_BUTTON_CLASS = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

export const AccionesLista = () => (
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
    debounce={300}
    perPage={10}
    containerClassName={LIST_CONTAINER_WIDE}
    pagination={<ListPaginator />}
    sort={{ field: "id", order: "DESC" }}
  >
    <PropiedadesListContent />
  </List>
);

export const PropiedadesListContent = () => (
  <>
    <AlquilerFilterLock />
    <ResponsiveDataTable
      rowClick="edit"
      bulkActionsToolbar={<FormOrderBulkActionsToolbar />}
      mobileConfig={{
        primaryField: "nombre",
        secondaryFields: [
          "propiedad_status_id",
          "valor_alquiler",
        ],
        detailFields: [],
      }}
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px] [&_tbody_td]:align-top"
    >
      <ListColumn source="id" label="ID" className="w-[60px]">
        <ListText source="id" />
      </ListColumn>
      <ListColumn source="nombre" label="Nombre" className="w-[150px]">
        <div className="flex flex-col gap-0">
          <ListText source="nombre" className="font-medium" />
          <ReferenceField source="propietario_id" reference="propietarios" link={false}>
            <ListText source="nombre" className="text-[8px] text-muted-foreground leading-tight" />
          </ReferenceField>
          <ReferenceField
            source="tipo_propiedad_id"
            reference="tipos-propiedad"
            link={false}
          >
            <ListText source="nombre" className="text-[7px] text-muted-foreground leading-tight" />
          </ReferenceField>
        </div>
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
      <ListColumn source="estado_comentario" label="Comentario" className="w-[200px]">
        <ComentarioCell />
      </ListColumn>
      <ListColumn label="Acciones" className="w-[60px]">
        <PropiedadRowActions />
      </ListColumn>
    </ResponsiveDataTable>
  </>
);

const ComentarioCell = () => {
  const record = useRecordContext<Propiedad>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(record?.estado_comentario ?? ""));
  }, [open, record?.estado_comentario]);

  if (!record) return null;

  const handleSave = async () => {
    if (!record?.id || saving) return;
    setSaving(true);
    try {
      await dataProvider.update("propiedades", {
        id: record.id,
        data: { estado_comentario: value },
        previousData: record,
      });
      notify("Comentario actualizado", { type: "info" });
      setOpen(false);
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar el comentario", { type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group block w-full text-left"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            data-row-click="ignore"
            aria-label="Editar comentario"
            title="Editar comentario"
          >
            <span className="inline-block w-full whitespace-normal break-words line-clamp-3 rounded-sm px-1 text-[9px] text-foreground/90 transition group-hover:bg-amber-100/80">
              {record.estado_comentario ? record.estado_comentario : "-"}
              <Pencil className="ml-1 inline-block h-2.5 w-2.5 text-amber-700/70 opacity-0 transition group-hover:opacity-100 group-hover:text-amber-700 align-[-1px]" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-72 border-none bg-transparent p-0 shadow-none"
        >
          <SectionBaseTemplate
            title="Editar comentario"
            main={
              <div className="space-y-2">
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-[80px] !text-[9px] !leading-tight px-2 py-1"
                  placeholder="Escribe un comentario..."
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={saving}
                    onClick={handleSave}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

const AlquilerFilterLock = () => {
  const location = useLocation();
  const { data: tiposOperacion = [] } = useGetList("crm/catalogos/tipos-operacion", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "nombre", order: "ASC" },
  });
  const { filterValues, setFilters } = useListContext();
  const appliedRef = useRef(false);
  const requestedTipoOperacionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("tipo_operacion_id") ?? undefined;
  }, [location.search]);
  const alquilerId = useMemo(() => {
    const alquiler = tiposOperacion.find(
      (tipo: any) =>
        tipo?.codigo?.toLowerCase().includes("alquiler") ||
        tipo?.nombre?.toLowerCase().includes("alquiler"),
    );
    return alquiler?.id ? String(alquiler.id) : undefined;
  }, [tiposOperacion]);
  const defaultTipoOperacionId = requestedTipoOperacionId ?? alquilerId;

  useEffect(() => {
    if (!defaultTipoOperacionId) {
      return;
    }
    if (filterValues.tipo_operacion_id) {
      appliedRef.current = true;
      return;
    }
    if (appliedRef.current) {
      return;
    }
    setFilters({ ...filterValues, tipo_operacion_id: defaultTipoOperacionId }, {});
    appliedRef.current = true;
  }, [defaultTipoOperacionId, filterValues, setFilters]);

  return null;
};
