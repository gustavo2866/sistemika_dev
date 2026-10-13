"use client";

import { useEffect, useState } from "react";
import { useDataProvider } from "ra-core";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  getEstadoParteBadgeClass,
  getEstadoParteLabel,
  type ParteDiarioDetalle,
  type ParteDiarioRecord,
} from "./model";

export type ParteDiarioLicenciaNovedad = {
  id: number | string;
  parte_diario_id: number | string;
  fecha: string;
  descripcion?: string | null;
  horas: number;
  parte_estado: string;
};

type ParteDiarioPopupProps = {
  licencia_id: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const formatFecha = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatHoras = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export const ParteDiarioPopup = ({
  licencia_id,
  open,
  onOpenChange,
}: ParteDiarioPopupProps) => {
  const dataProvider = useDataProvider();
  const [rows, setRows] = useState<ParteDiarioLicenciaNovedad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !licencia_id) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await dataProvider.getList<ParteDiarioRecord>("parte-diario", {
          filter: { "detalles.nomina_licencia_id": licencia_id },
          pagination: { page: 1, perPage: 100 },
          sort: { field: "fecha", order: "DESC" },
        });
        if (!active) return;
        setRows(
          response.data.flatMap((parte) => {
            const detalles = (parte.detalles ?? []).filter(
              (detalle: ParteDiarioDetalle) =>
                Number(detalle.nomina_licencia_id) === licencia_id,
            );
            return detalles.map((detalle, index) => ({
              id: detalle.id ?? `${parte.id}-${index}`,
              parte_diario_id: parte.id ?? "",
              fecha: String(parte.fecha ?? ""),
              descripcion: detalle.descripcion,
              horas: Number(detalle.horas ?? 0),
              parte_estado: String(parte.estado ?? ""),
            }));
          }),
        );
      } catch (loadError) {
        if (!active) return;
        setRows([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los partes diarios",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [dataProvider, licencia_id, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novedades de la licencia</DialogTitle>
          <DialogDescription>
            Partes diarios vinculados a la licencia seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Cargando...</p>
          ) : error ? (
            <p className="p-6 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              La licencia no tiene partes diarios asociados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[80px] text-right">Horas</TableHead>
                  <TableHead className="w-[150px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatFecha(row.fecha)}</TableCell>
                    <TableCell className="max-w-[380px] whitespace-normal break-words">
                      {row.descripcion || "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatHoras(row.horas)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          getEstadoParteBadgeClass(row.parte_estado),
                        )}
                      >
                        {getEstadoParteLabel(row.parte_estado)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
