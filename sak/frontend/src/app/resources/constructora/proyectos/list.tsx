"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListContextProvider, useList, useListContext, useRecordContext } from "ra-core";
import { List, LIST_CONTAINER_STANDARD } from "@/components/list";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { dataProvider } from "@/lib/dataProvider";
import {
  DateListColumn,
  FormOrderListRowActions,
  ListDate,
  ListText,
  NumberListColumn,
  ResponsiveDataTable,
  TextListColumn,
  buildListFilters,
} from "@/components/forms/form_order";
import { getProyectoUltimoAvance } from "./model";

const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        placeholder: "Buscar proyectos",
        alwaysOn: true,
        className: "w-[120px] sm:w-[170px]",
      },
    },
    {
      type: "text",
      props: {
        source: "estado",
        label: "Estado",
      },
    },
    {
      type: "text",
      props: {
        source: "centro_costo",
        label: "Centro de costo",
      },
    },
  ],
  { keyPrefix: "proyectos" },
);

const actionButtonClass = "h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs";

type ProyectoListProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} size="sm" buttonClassName={actionButtonClass} />
    <CreateButton className={actionButtonClass} label="Crear" />
    <ExportButton className={actionButtonClass} label="Exportar" />
  </div>
);

const UltimoAvanceField = () => {
  const record = useRecordContext<{ avances?: Array<{ avance?: number; fecha_registracion?: string }> }>();
  const value = useMemo(() => getProyectoUltimoAvance(record?.avances), [record?.avances]);
  return <span>{value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%</span>;
};

const ProyectoInfiniteDataTable = ({
  rowClick,
  perPage,
  embedded,
}: {
  rowClick: any;
  perPage: number;
  embedded: boolean;
}) => {
  const { filterValues, sort } = useListContext();
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestKey = useMemo(
    () => JSON.stringify({ filterValues, sort, perPage }),
    [filterValues, perPage, sort],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    setHasMore(true);

    dataProvider
      .getList("proyectos", {
        pagination: { page: 1, perPage },
        sort,
        filter: filterValues,
      })
      .then((response) => {
        if (cancelled) return;
        setRecords(response.data);
        setTotal(response.total ?? response.data.length);
        setHasMore(response.data.length < (response.total ?? response.data.length));
      })
      .catch((error) => {
        console.error("No se pudo cargar proyectos", error);
        if (!cancelled) {
          setRecords([]);
          setTotal(0);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [perPage, requestKey, filterValues, sort]);

  useEffect(() => {
    if (!hasMore || loading) return;
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setPage((current) => current + 1);
      },
      {
        root: null,
        rootMargin: "0px 0px 240px 0px",
        threshold: 0,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, records.length]);

  useEffect(() => {
    if (page <= 1) return;
    let cancelled = false;
    setLoading(true);

    dataProvider
      .getList("proyectos", {
        pagination: { page, perPage },
        sort,
        filter: filterValues,
      })
      .then((response) => {
        if (cancelled) return;
        let mergedLength = 0;
        setRecords((prev) => {
          const seen = new Set(prev.map((item) => String(item.id)));
          const nextRows = response.data.filter((item) => !seen.has(String(item.id)));
          const merged = [...prev, ...nextRows];
          mergedLength = merged.length;
          return merged;
        });
        setTotal(response.total ?? total);
        setHasMore(mergedLength < (response.total ?? mergedLength));
      })
      .catch((error) => {
        console.error("No se pudo cargar mas proyectos", error);
        if (!cancelled) {
          setHasMore(false);
          setPage((current) => Math.max(1, current - 1));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, perPage, requestKey, filterValues, sort]);

  const listContext = useList({
    data: records,
    resource: "proyectos",
    perPage: records.length || perPage,
    sort,
    isPending: loading && records.length === 0,
  });

  return (
    <ListContextProvider value={listContext}>
      <div className="space-y-2">
        <ResponsiveDataTable
          rowClick={rowClick}
          mobileConfig={{
            primaryField: "nombre",
            secondaryFields: ["estado", "fecha_inicio", "fecha_final"],
          }}
          className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
        >
          <NumberListColumn source="id" label="ID" className="text-center" widthClass="w-[80px]" />
          <TextListColumn source="nombre" label="Nombre" className="w-[170px]">
            <ListText source="nombre" className="whitespace-normal break-words" />
          </TextListColumn>
          <TextListColumn source="estado" label="Estado" className="w-[90px]">
            <ListText source="estado" />
          </TextListColumn>
          <DateListColumn source="fecha_inicio" label="Inicio" className="w-[80px]">
            <ListDate source="fecha_inicio" />
          </DateListColumn>
          <NumberListColumn source="centro_costo" label="CCosto" className="w-[75px] text-center" />
          <NumberListColumn source="ingresos" label="Ingresos" className="w-[95px] text-right" />
          <NumberListColumn label="Avance" className="w-[90px] text-center">
            <UltimoAvanceField />
          </NumberListColumn>
          <TextListColumn label="Acciones" className="w-[80px]">
            <FormOrderListRowActions showShow={!embedded} />
          </TextListColumn>
        </ResponsiveDataTable>

        {loading && records.length > 0 ? (
          <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
            Cargando mas proyectos...
          </div>
        ) : null}

        {!loading && records.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No hay proyectos para mostrar.
          </div>
        ) : null}

        {hasMore ? <div ref={sentinelRef} className="h-px w-full opacity-0" aria-hidden="true" /> : null}
      </div>
    </ListContextProvider>
  );
};

export const ProyectoList = ({
  embedded = false,
  rowClick = "edit",
  perPage = 10,
}: ProyectoListProps = {}) => (
  <List
    title="Proyectos"
    filters={filters}
    actions={<ListActions />}
    debounce={300}
    perPage={perPage}
    pagination={false}
    sort={{ field: "id", order: "DESC" }}
    containerClassName={LIST_CONTAINER_STANDARD}
    showBreadcrumb={!embedded}
    showHeader={!embedded}
  >
    <ProyectoInfiniteDataTable rowClick={rowClick} perPage={perPage} embedded={embedded} />
  </List>
);
