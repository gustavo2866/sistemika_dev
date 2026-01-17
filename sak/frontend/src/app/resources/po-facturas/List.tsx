"use client";

import { useState } from "react";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { KanbanAvatar } from "@/components/kanban/card";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { Badge } from "@/components/ui/badge";
import { Confirm } from "@/components/confirm";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { MoreHorizontal } from "lucide-react";
import type { PoFactura } from "./model";
import { ESTADO_CHOICES } from "./model";

const ESTADO_BADGES: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-800",
  procesada: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  pagada: "bg-amber-100 text-amber-800",
  anulada: "bg-slate-200 text-slate-600",
};

const formatNumero = (value?: string | number) => {
  if (value == null || value === "") return "";
  return String(value);
};

const getResponsableAvatarInfo = (record?: PoFactura) => {
  const responsable = (record as { usuario_responsable?: { nombre?: string; nombre_completo?: string; email?: string; avatar?: string; url_foto?: string } })
    ?.usuario_responsable;
  const name =
    responsable?.nombre_completo ||
    responsable?.nombre ||
    responsable?.email ||
    (record?.usuario_responsable_id ? `Usuario #${record.usuario_responsable_id}` : "Usuario");
  const avatarUrl = responsable?.avatar || responsable?.url_foto || null;
  const initials = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return { name, avatarUrl, initials };
};

const filters = [
  <TextInput
    key="q"
    source="q"
    label="Buscar"
    alwaysOn
    placeholder="Buscar facturas"
  />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={ESTADO_CHOICES}
    alwaysOn
  />,
  <ReferenceInput
    key="proveedor_id"
    source="proveedor_id"
    reference="proveedores"
    label="Proveedor"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="usuario_responsable_id"
    source="usuario_responsable_id"
    reference="users"
    label="Responsable"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="centro_costo_id"
    source="centro_costo_id"
    reference="centros-costo"
    label="Centro de costo"
    filter={{ activo: true }}
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="metodo_pago_id"
    source="metodo_pago_id"
    reference="metodos-pago"
    label="Metodo de pago"
  >
    <SelectInput optionText="nombre" emptyText="Todos" />
  </ReferenceInput>,
  <ReferenceInput
    key="tipo_solicitud_id"
    source="tipo_solicitud_id"
    reference="tipos-solicitud"
    label="Tipo solicitud"
  >
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

export const PoFacturaList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    perPage={25}
    sort={{ field: "id", order: "DESC" }}
    filterDefaultValues={{ estado: "pendiente" }}
  >
    <ResponsiveDataTable
      rowClick="edit"
      className="text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
    >
      <ResponsiveDataTable.Col
        source="numero"
        label="Numero"
        className="w-[100px]"
        render={(record) => formatNumero(record?.numero)}
      />
      <ResponsiveDataTable.Col source="proveedor_id" label="Proveedor" className="w-[150px]">
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="usuario_responsable_id"
        label="Resp"
        className="w-[80px]"
        render={(record) => {
          const { name, avatarUrl, initials } = getResponsableAvatarInfo(record as PoFactura);
          return (
            <div className="flex w-full items-center justify-start">
              <KanbanAvatar
                src={avatarUrl}
                alt={name}
                fallback={initials}
                className="border-white/70 shadow-sm"
              />
            </div>
          );
        }}
      />
      <ResponsiveDataTable.Col source="fecha_emision" label="Fecha" className="w-[70px]">
        <DateField source="fecha_emision" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="estado" label="Estado" className="w-[80px]">
        <EstadoBadge />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="total" label="Total" className="w-[120px]">
        <NumberField source="total" options={{ style: "currency", currency: "ARS" }} />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
        <PoFacturaActionsMenu />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);

const PoFacturaActionsMenu = () => {
  const record = useRecordContext<PoFactura>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!record || !resource) {
    return null;
  }

  const handleDelete = async () => {
    if (!record?.id) return;
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Factura eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la factura", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const stopRowClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMenuAction = (event: React.MouseEvent, callback: () => void) => {
    stopRowClick(event);
    if (busyAction !== null) {
      return;
    }
    callback();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busyAction !== null}
            onClick={stopRowClick}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => redirect("edit", resource, record.id))
            }
            disabled={busyAction !== null}
          >
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => handleMenuAction(event, () => setConfirmOpen(true))}
            disabled={busyAction !== null}
            variant="destructive"
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          handleDelete();
        }}
        title="Eliminar factura"
        content="Seguro que deseas eliminar la factura?"
        confirmColor="warning"
        loading={busyAction !== null}
      />
    </>
  );
};

const EstadoBadge = () => {
  const record = useRecordContext<PoFactura>();
  const estadoKey = record?.estado;
  if (!estadoKey) return null;
  const estadoLabel =
    ESTADO_CHOICES.find((choice) => choice.id === estadoKey)?.name ||
    estadoKey;
  const badgeClass = ESTADO_BADGES[estadoKey] || "bg-slate-100 text-slate-800";

  return (
    <Badge className={`${badgeClass} px-1.5 py-0 text-[9px] sm:text-[10px]`}>
      {estadoLabel}
    </Badge>
  );
};
