/**
 * Lista de Ordenes de Compra.
 *
 * Estructura:
 * 1. CONFIGURACION - Filtros y acciones de lista
 * 2. HELPERS - Utilidades de presentacion locales
 * 3. COMPONENTE - Lista principal
 * 4. ACCIONES - Menu estandar por fila
 */

"use client";

import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { buildListFilters } from "@/components/lists/filters";
import {
  CompactFilterButton,
  CompactExportButton,
  CompactCreateButton,
} from "@/components/lists/actions";
import { BadgeField } from "@/components/badge-field";
import { KanbanAvatar } from "@/components/kanban/card";
import { useGetIdentity, useRefresh } from "ra-core";
import type { PoOrdenCompra } from "./model";
import { ESTADO_BADGES, ESTADO_CHOICES, TIPO_COMPRA_CHOICES } from "./model";
import { ListRowActions } from "./list_actions";

//********************************* */
// region 1. CONFIGURACION

// Define los filtros declarativos de la lista.
const filters = buildListFilters(
  [
    {
      type: "text",
      props: {
        source: "q",
        label: "Buscar",
        alwaysOn: true,
        placeholder: "Buscar ordenes de compra",
        className: "w-28 sm:w-32",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "proveedor_id",
        reference: "proveedores",
        label: "Proveedor",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "tipo_solicitud_id",
        reference: "tipos-solicitud",
        label: "Tipo",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "departamento_id",
        reference: "departamentos",
        label: "Departamento",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "centro_costo_id",
        reference: "centros-costo",
        label: "Centro de costo",
        filter: { activo: true },
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "select",
      props: {
        source: "tipo_compra",
        label: "Tipo compra",
        choices: TIPO_COMPRA_CHOICES,
      },
    },
    {
      type: "select",
      props: {
        source: "estado",
        label: "Estado",
        choices: ESTADO_CHOICES,
        alwaysOn: true,
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "usuario_responsable_id",
        reference: "users",
        label: "Responsable",
        alwaysOn: true,
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
    {
      type: "reference",
      referenceProps: {
        source: "metodo_pago_id",
        reference: "metodos-pago",
        label: "Metodo pago",
      },
      selectProps: {
        optionText: "nombre",
        emptyText: "Todos",
      },
    },
  ],
  { keyPrefix: "po-ordenes-compra" }
);

// Renderiza acciones superiores de la lista.
const ListActions = ({ createTo }: { createTo?: string }) => (
  <div className="flex items-center justify-start gap-2">
    <CompactFilterButton filters={filters as any} />
    {createTo ? <CompactCreateButton to={createTo} /> : null}
    <CompactExportButton />
  </div>
);
// endregion

//********************************* */
// region 2. HELPERS

// Arma datos de avatar del responsable para la grilla.
const getResponsableAvatarInfo = (record?: PoOrdenCompra) => {
  const responsable = (record as { usuario_responsable?: { nombre?: string; nombre_completo?: string; email?: string; avatar?: string; url_foto?: string } })
    ?.usuario_responsable;
  const name =
    responsable?.nombre_completo ||
    responsable?.nombre ||
    responsable?.email ||
    (record?.usuario_responsable_id
      ? `Usuario #${record.usuario_responsable_id}`
      : "Usuario");
  const avatarUrl = responsable?.avatar || responsable?.url_foto || null;
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return { name, avatarUrl, initials };
};
// endregion

//********************************* */
// region 3. COMPONENTE

// Renderiza la lista principal de ordenes de compra.
export const PoOrdenCompraList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data: identity } = useGetIdentity();
  const defaultFilters = useMemo(
    () => ({
      estado: "borrador",
      tipo_compra: "normal",
      ...(identity?.id ? { usuario_responsable_id: identity.id } : {}),
    }),
    [identity?.id]
  );
  const createTo = useMemo(() => {
    const createPath = "/po-ordenes-compra/create";
    const params = new URLSearchParams();
    params.set("wizard", "asistida");
    return `${createPath}?${params.toString()}`;
  }, []);
  return (
    <List
      filters={filters as any}
      actions={<ListActions createTo={createTo} />}
      perPage={10}
      sort={{ field: "id", order: "DESC" }}
      filterDefaultValues={defaultFilters}
    >
      <PoOrdenCompraRefreshOnReturn
        location={location}
        navigate={navigate}
        refresh={refresh}
      />
      <ResponsiveDataTable
        rowClick="edit"
        className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
      >
        <ResponsiveDataTable.Col
          source="id"
          label="Id"
          className="w-[44px]"
          cellClassName="text-center"
          headerClassName="text-center"
        >
          <NumberField source="id" className="inline-block w-full text-center text-[9px] sm:text-[10px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="titulo"
          label="Titulo"
          className="w-[140px] whitespace-normal break-words"
        >
          <TextField source="titulo" className="whitespace-normal break-words" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="proveedor_id"
          label="Proveedor"
          className="w-[110px] whitespace-nowrap"
        >
          <ReferenceField source="proveedor_id" reference="proveedores">
            <TextField source="nombre" className="truncate" />
          </ReferenceField>
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="usuario_responsable_id"
          label="Responsable"
          className="w-[90px] whitespace-nowrap"
          render={(record) => {
            const { name, avatarUrl, initials } = getResponsableAvatarInfo(record as PoOrdenCompra);
            return (
              <div className="flex w-full items-center gap-2">
                <KanbanAvatar
                  src={avatarUrl}
                  alt={name}
                  fallback={initials}
                  className="border-white/70 shadow-sm"
                />
                <span className="text-[9px] leading-tight text-muted-foreground sm:text-[10px] truncate">
                  {name}
                </span>
              </div>
            );
          }}
        />
        <ResponsiveDataTable.Col
          source="fecha"
          label="Fecha"
          className="w-[110px] text-center"
        >
          <DateField source="fecha" className="inline-block text-center w-full text-[9px] sm:text-[10px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col
          source="estado"
          label="Estado"
          className="w-[90px]"
          render={(record) => {
            const estadoKey = String(record?.estado ?? "");
            return (
              <BadgeField
                source="estado"
                record={record}
                className={`${ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800"} text-[9px] sm:text-[10px]`}
              />
            );
          }}
        />
        <ResponsiveDataTable.Col source="total" label="Importe" className="w-[110px]">
          <NumberField source="total" options={{ style: "currency", currency: "ARS" }} className="text-[8px] sm:text-[9px]" />
        </ResponsiveDataTable.Col>
        <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
          <ListRowActions />
        </ResponsiveDataTable.Col>
      </ResponsiveDataTable>
    </List>
  );
};

// Fuerza refresh al volver desde create/edit cuando se pide.
const PoOrdenCompraRefreshOnReturn = ({
  location,
  navigate,
  refresh,
}: {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  refresh: () => void;
}) => {
  useEffect(() => {
    const state = location.state as { refresh?: boolean } | null;
    if (!state?.refresh) {
      return;
    }
    refresh();
    navigate(`${location.pathname}${location.search}`, { replace: true });
  }, [location, navigate, refresh]);

  return null;
};
// endregion

//********************************* */
// region 4. ACCIONES

// endregion
