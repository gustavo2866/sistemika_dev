"use client";

import { useState } from "react";
import { List } from "@/components/list";
import { ResponsiveDataTable } from "@/components/lists/responsive-data-table";
import { TextField } from "@/components/text-field";
import { NumberField } from "@/components/number-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
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
  DropdownMenuSeparator,
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
import { KanbanAvatar } from "@/components/kanban/card";
import type { PoOrdenCompra } from "./model";
import { ESTADO_CHOICES, TIPO_COMPRA_CHOICES } from "./model";

const ESTADO_BADGES: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  emitida: "bg-sky-100 text-sky-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  rechazada: "bg-rose-100 text-rose-800",
  recibida: "bg-amber-100 text-amber-800",
  cerrada: "bg-indigo-100 text-indigo-800",
  anulada: "bg-slate-200 text-slate-600",
};

const getResponsableAvatarInfo = (record?: PoOrdenCompra) => {
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
    placeholder="Buscar ordenes de compra"
  />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={ESTADO_CHOICES}
    alwaysOn
  />,
  <SelectInput
    key="tipo_compra"
    source="tipo_compra"
    label="Tipo compra"
    choices={TIPO_COMPRA_CHOICES}
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
    key="departamento_id"
    source="departamento_id"
    reference="departamentos"
    label="Departamento"
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
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton />
  </div>
);

export const PoOrdenCompraList = () => (
  <List
    filters={filters}
    actions={<ListActions />}
    perPage={25}
    sort={{ field: "id", order: "DESC" }}
    filterDefaultValues={{ estado: "borrador" }}
  >
    <ResponsiveDataTable rowClick="edit">
      <ResponsiveDataTable.Col source="id" label="ID" className="w-[70px]">
        <NumberField source="id" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="titulo"
        label="Titulo"
        className="w-[180px] whitespace-normal break-words"
      >
        <TextField source="titulo" className="text-[11px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="fecha" label="Fecha" className="w-[90px]">
        <DateField source="fecha" className="text-[11px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="proveedor_id"
        label="Proveedor"
        className="w-[140px] whitespace-normal break-words"
      >
        <ReferenceField source="proveedor_id" reference="proveedores">
          <TextField source="nombre" className="text-[11px]" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col
        source="usuario_responsable_id"
        label="Resp"
        className="w-[80px]"
        render={(record) => {
          const { name, avatarUrl, initials } = getResponsableAvatarInfo(record as PoOrdenCompra);
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
      <ResponsiveDataTable.Col source="estado" label="Estado" className="w-[120px]">
        <div className="flex flex-col gap-1">
          <EstadoBadge />
          <DateField source="fecha_estado" className="text-[10px] text-muted-foreground" />
        </div>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="tipo_compra" label="Tipo compra" className="w-[110px]">
        <TextField source="tipo_compra" className="text-[11px]" />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="departamento_id" label="Departamento" className="w-[160px]">
        <ReferenceField source="departamento_id" reference="departamentos">
          <TextField source="nombre" className="text-[11px]" />
        </ReferenceField>
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col source="total" label="Total" className="w-[120px]">
        <NumberField
          source="total"
          options={{ style: "currency", currency: "ARS" }}
          className="text-[11px]"
        />
      </ResponsiveDataTable.Col>
      <ResponsiveDataTable.Col label="Acciones" className="w-[120px]">
        <PoOrdenCompraActionsMenu />
      </ResponsiveDataTable.Col>
    </ResponsiveDataTable>
  </List>
);

const PoOrdenCompraActionsMenu = () => {
  const record = useRecordContext<PoOrdenCompra>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const resource = useResourceContext();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "delete" | null>(null);

  if (!record || !resource) {
    return null;
  }

  const canApprove = record.estado === "emitida";
  const canReject = record.estado === "emitida" || record.estado === "aprobada";

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const handleStatusChange = async (estado: "aprobada" | "rechazada") => {
    if (!record?.id) {
      return;
    }
    setBusyAction(estado);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }
      const response = await fetch(
        `${apiBaseUrl}/po-ordenes-compra/${record.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ estado }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      notify(
        `Orden ${estado === "aprobada" ? "aprobada" : "rechazada"} correctamente`,
        { type: "info" }
      );
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo actualizar la orden", { type: "warning" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    setBusyAction("delete");
    try {
      await dataProvider.delete(resource, { id: record.id });
      notify("Orden eliminada", { type: "info" });
      refresh();
    } catch (error) {
      console.error(error);
      notify("No se pudo eliminar la orden", { type: "warning" });
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

  const openConfirm = (action: "approve" | "reject" | "delete") => {
    if (busyAction !== null) return;
    setConfirmAction(action);
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmTitle = {
    approve: "Aprobar orden",
    reject: "Rechazar orden",
    delete: "Eliminar orden",
  }[confirmAction ?? "approve"];

  const confirmContent = {
    approve: "Seguro que deseas aprobar la orden?",
    reject: "Seguro que deseas rechazar la orden?",
    delete: "Seguro que deseas eliminar la orden?",
  }[confirmAction ?? "approve"];

  const handleConfirm = () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    if (action === "delete") {
      handleDelete();
      return;
    }
    handleStatusChange(action === "approve" ? "aprobada" : "rechazada");
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
            onClick={(event) => handleMenuAction(event, () => openConfirm("delete"))}
            disabled={busyAction !== null}
            variant="destructive"
          >
            Eliminar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => canApprove && openConfirm("approve"))
            }
            disabled={!canApprove || busyAction !== null}
          >
            Aprobar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) =>
              handleMenuAction(event, () => canReject && openConfirm("reject"))
            }
            disabled={!canReject || busyAction !== null}
          >
            Rechazar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        isOpen={confirmAction !== null}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmTitle}
        content={confirmContent}
        confirmColor={confirmAction === "delete" ? "warning" : "primary"}
        loading={busyAction !== null}
      />
    </>
  );
};

const EstadoBadge = () => {
  const record = useRecordContext<PoOrdenCompra>();
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
