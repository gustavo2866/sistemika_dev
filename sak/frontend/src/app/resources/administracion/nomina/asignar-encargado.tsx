"use client";

import { useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { UserRoundCheck } from "lucide-react";

import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type NominaSeleccionada = {
  id: number | string;
  apellido?: string | null;
  nombre?: string | null;
};

type EncargadoOption = {
  id: number | string;
  nombre_completo?: string | null;
};

type ProyectoOption = {
  id: number | string;
  nombre?: string | null;
};

const nombreEmpleado = (record: NominaSeleccionada) =>
  [record.apellido, record.nombre]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");

export const NominaAsignarEncargadoButton = () => {
  const { selectedIds, onUnselectItems } = useListContext();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empleados, setEmpleados] = useState<NominaSeleccionada[]>([]);
  const [proyectoId, setProyectoId] = useState("");
  const [contactoId, setContactoId] = useState("");

  const { data: proyectos = [], isPending: loadingProyectos } =
    useGetList<ProyectoOption>("proyectos", {
      pagination: { page: 1, perPage: 250 },
      sort: { field: "nombre", order: "ASC" },
      filter: {},
    });

  const { data: encargados = [], isPending: loadingEncargados } =
    useGetList<EncargadoOption>("crm/contactos", {
      pagination: { page: 1, perPage: 250 },
      sort: { field: "nombre_completo", order: "ASC" },
      filter: { "tipo.nombre": "Encargado" },
    });

  const empleadosTexto = useMemo(
    () => empleados.map(nombreEmpleado).filter(Boolean).join("; "),
    [empleados],
  );
  const encargadoSeleccionado = encargados.find(
    (item) => String(item.id) === contactoId,
  );
  const proyectoSeleccionado = proyectos.find(
    (item) => String(item.id) === proyectoId,
  );

  const handleOpen = async () => {
    if (!selectedIds?.length || loading) return;
    setLoading(true);
    try {
      const { data } = await dataProvider.getMany<NominaSeleccionada>("nominas", {
        ids: selectedIds,
      });
      setEmpleados(
        [...data].sort((left, right) =>
          nombreEmpleado(left).localeCompare(nombreEmpleado(right), "es", {
            sensitivity: "base",
          }),
        ),
      );
      setProyectoId("");
      setContactoId("");
      setOpen(true);
    } catch (error) {
      console.error(error);
      notify("No se pudieron cargar los empleados seleccionados", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!proyectoId || !contactoId) {
      notify("Selecciona un proyecto y un encargado", { type: "warning" });
      return;
    }
    setOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!proyectoId || !contactoId || !selectedIds?.length) return;
    setLoading(true);
    try {
      await dataProvider.create("nominas/asignar-encargado", {
        data: {
          nomina_ids: selectedIds.map((id) => Number(id)),
          proyecto_id: Number(proyectoId),
          contacto_id: Number(contactoId),
        },
      });
      notify(`Se asignaron ${selectedIds.length} empleados al encargado`, {
        type: "info",
      });
      setConfirmOpen(false);
      onUnselectItems();
      refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => void handleOpen()}
        disabled={!selectedIds?.length || loading}
        className="h-7 gap-1 px-2 text-[10px] sm:h-8 sm:text-[11px]"
      >
        <UserRoundCheck className="h-3.5 w-3.5" />
        Asignar
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !loading && setOpen(nextOpen)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar encargado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Empleados</label>
              <Textarea
                value={empleadosTexto}
                readOnly
                rows={4}
                className="resize-none text-[10px] leading-4"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Proyecto</label>
              <Select value={proyectoId} onValueChange={setProyectoId}>
                <SelectTrigger className="w-full" disabled={loadingProyectos}>
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {proyectos.map((proyecto) => (
                    <SelectItem key={proyecto.id} value={String(proyecto.id)}>
                      {proyecto.nombre || `#${proyecto.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Encargado</label>
              <Select value={contactoId} onValueChange={setContactoId}>
                <SelectTrigger className="w-full" disabled={loadingEncargados}>
                  <SelectValue placeholder="Seleccionar encargado" />
                </SelectTrigger>
                <SelectContent>
                  {encargados.map((encargado) => (
                    <SelectItem key={encargado.id} value={String(encargado.id)}>
                      {encargado.nombre_completo || `#${encargado.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={!proyectoId || !contactoId}
            >
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Confirm
        isOpen={confirmOpen}
        onClose={() => !loading && setConfirmOpen(false)}
        onConfirm={() => void handleConfirm()}
        title="Confirmar asignacion"
        content={
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Se asignaran {empleados.length} empleados al proyecto{" "}
              <span className="font-semibold text-foreground">
                {proyectoSeleccionado?.nombre}
              </span>{" "}
              y al encargado{" "}
              <span className="font-semibold text-foreground">
                {encargadoSeleccionado?.nombre_completo}
              </span>
              .
            </p>
            <p className="text-xs">
              Si la relacion entre el proyecto y el encargado no existe, se creara
              como no principal.
            </p>
          </div>
        }
        confirm="Asignar"
        loading={loading}
      />
    </>
  );
};
