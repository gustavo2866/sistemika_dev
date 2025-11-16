"use client";

import { useState } from "react";
import { List } from "@/components/list";
import { DataTable } from "@/components/data-table";
import { TextField } from "@/components/text-field";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { BulkDeleteButton } from "@/components/bulk-delete-button";
import { NumberField } from "@/components/number-field";
import { Badge } from "@/components/ui/badge";
import { SelectInput } from "@/components/select-input";
import {
  formatEstadoPropiedad,
  ESTADOS_PROPIEDAD_OPTIONS,
  TRANSICIONES_ESTADO_PROPIEDAD,
  type Propiedad,
  type PropiedadEstado,
} from "./model";
import {
  useNotify,
  useRecordContext,
  useRefresh,
  useRedirect,
  useResourceContext,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const filters = [
  <TextInput key="q" source="q" label={false} placeholder="Buscar por nombre o propietario" alwaysOn />,
  <TextInput key="tipo" source="tipo" label="Tipo" />,
  <TextInput key="propietario" source="propietario" label="Propietario" />,
  <SelectInput
    key="estado"
    source="estado"
    label="Estado"
    choices={ESTADOS_PROPIEDAD_OPTIONS.map((option) => ({ id: option.value, name: option.label }))}
  />,
  <TextInput key="ambientes__gte" source="ambientes__gte" label="Ambientes >=" type="number" />,
  <TextInput key="ambientes__lte" source="ambientes__lte" label="Ambientes <=" type="number" />,
  <TextInput key="metros_cuadrados__gte" source="metros_cuadrados__gte" label="Metros2 >=" type="number" />,
  <TextInput key="metros_cuadrados__lte" source="metros_cuadrados__lte" label="Metros2 <=" type="number" />,
  <TextInput key="valor_alquiler__gte" source="valor_alquiler__gte" label="Alquiler >=" type="number" />,
  <TextInput key="valor_alquiler__lte" source="valor_alquiler__lte" label="Alquiler <=" type="number" />,
];

const ListActions = () => (
  <div className="flex items-center gap-2">
    <FilterButton filters={filters} />
    <CreateButton />
    <ExportButton className="h-9" />
  </div>
);

const PropiedadBulkActions = () => (
  <>
    <BulkDeleteButton />
  </>
);

export const PropiedadList = () => (
  <List filters={filters} actions={<ListActions />} perPage={25}>
    <DataTable rowClick="edit" bulkActionButtons={<PropiedadBulkActions />}>
      <DataTable.Col source="nombre" label="Nombre" className="w-[180px]">
        <div className="flex flex-col gap-0.5">
          <TextField source="nombre" className="font-medium truncate" />
          <span className="text-xs text-muted-foreground truncate">
            <TextField source="propietario" />
          </span>
        </div>
      </DataTable.Col>
      <DataTable.Col source="tipo" label="Tipo" className="w-[110px]">
        <TextField source="tipo" />
      </DataTable.Col>
      <DataTable.Col source="ambientes" label="Ambientes" className="w-[70px] text-right">
        <NumberField source="ambientes" />
      </DataTable.Col>
      <DataTable.Col source="metros_cuadrados" label="m²" className="w-[90px] text-right">
        <NumberField source="metros_cuadrados" options={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
      </DataTable.Col>
      <DataTable.Col source="valor_alquiler" label="Valor alquiler" className="w-[150px] text-right">
        <NumberField
          source="valor_alquiler"
          options={{ style: "currency", currency: "ARS", maximumFractionDigits: 0 }}
        />
      </DataTable.Col>
      <DataTable.Col source="estado" label="Estado" className="w-[120px]">
        <EstadoBadge />
      </DataTable.Col>
      <DataTable.Col label="Acciones" className="w-[64px] text-right pr-2">
        <PropiedadActionsMenu />
      </DataTable.Col>
    </DataTable>
  </List>
);

export const PropiedadActionsMenu = ({
  propiedad,
  onChanged,
}: {
  propiedad?: Propiedad;
  onChanged?: () => void;
}) => {
  const contextRecord = useRecordContext<Propiedad>();
  const record = propiedad ?? contextRecord;
  const resource = useResourceContext() || "propiedades";
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comentario, setComentario] = useState("");
  const [targetEstado, setTargetEstado] = useState<PropiedadEstado | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!record) {
    return null;
  }

  const allowedTransitions = new Set(TRANSICIONES_ESTADO_PROPIEDAD[record.estado] ?? []);

  const stopRowClick = (event?: React.MouseEvent) => {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMenuAction = (event: React.MouseEvent | null, callback: () => void) => {
    stopRowClick(event);
    if (submitting) return;
    callback();
  };

  const openTransitionDialog = (estado: PropiedadEstado) => {
    setTargetEstado(estado);
    setComentario("");
    setDialogOpen(true);
  };

  const handleConfirmTransition = async () => {
    if (!record?.id || !targetEstado) {
      return;
    }
    setSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const response = await fetch(`${API_URL}/propiedades/${record.id}/cambiar-estado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nuevo_estado: targetEstado,
          comentario: comentario || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail ?? "No se pudo aplicar la transicion");
      }
      notify(`Estado actualizado a ${formatEstadoPropiedad(targetEstado)}`, { type: "success" });
      setDialogOpen(false);
      setTargetEstado(null);
      setComentario("");
      refresh();
      onChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      notify(message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const currentEstadoLabel = formatEstadoPropiedad(record.estado);
  const targetEstadoLabel = targetEstado ? formatEstadoPropiedad(targetEstado) : "";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopRowClick}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={(event) => handleMenuAction(event, () => redirect("edit", resource, record.id))}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(event) => handleMenuAction(event, () => redirect("show", resource, record.id))}>
            Mostrar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {ESTADOS_PROPIEDAD_OPTIONS.map((option) => {
            const isCurrent = option.value === record.estado;
            const isAllowed = allowedTransitions.has(option.value);
            return (
              <DropdownMenuItem
                key={option.value}
                disabled={isCurrent || !isAllowed || submitting}
                onClick={(event) => handleMenuAction(event, () => openTransitionDialog(option.value))}
                className="text-sm"
              >
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setComentario("");
            setTargetEstado(null);
          }
        }}
      >
        <DialogContent
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Confirmar transición de estado</DialogTitle>
            <DialogDescription>
              {targetEstado
                ? `Pasar de ${currentEstadoLabel} a ${targetEstadoLabel}.`
                : "Selecciona un estado para continuar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="comentario-transicion">Comentario</Label>
            <Textarea
              id="comentario-transicion"
              rows={4}
              placeholder="Detalle la razon del cambio"
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmTransition} disabled={submitting || !targetEstado}>
              {submitting ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const EstadoBadge = () => {
  const record = useRecordContext<Propiedad>();

  if (!record) {
    return null;
  }

  const estado = ESTADOS_PROPIEDAD_OPTIONS.find((option) => option.value === record.estado);

  return (
    <Badge className={estado?.badgeColor ?? "bg-slate-200 text-slate-800"} variant="outline">
      {formatEstadoPropiedad(record.estado)}
    </Badge>
  );
};
