"use client";

import { useEffect, useMemo, useState } from "react";
import { Show } from "@/components/show";
import { TextField } from "@/components/text-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDataProvider, useRecordContext } from "ra-core";
import { preferCalculated } from "@/lib/vacancias/metrics";
import type { Propiedad, Vacancia } from "./model";
import { formatEstadoPropiedad } from "./model";
import { VacanciaTimeline } from "./components/vacancia-timeline";
import { ChangeStateDialog } from "./components/change-state-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleSection } from "@/components/forms";

export const PropiedadShow = () => (
  <Show>
    <PropiedadDetails />
  </Show>
);

const PropiedadDetails = () => {
  const record = useRecordContext<Propiedad>();
  const dataProvider = useDataProvider();
  const [vacancias, setVacancias] = useState<Vacancia[]>(record?.vacancias ?? []);
  const [vacanciaVersion, setVacanciaVersion] = useState(0);

  useEffect(() => {
    if (!record?.id) return;
    if (record?.vacancias?.length) {
      setVacancias(record.vacancias);
      return;
    }

    let isCancelled = false;
    const fetchVacancias = async () => {
      try {
        const result = await dataProvider.getList<Vacancia>("vacancias", {
          filter: { propiedad_id: record.id },
          pagination: { page: 1, perPage: 50 },
          sort: { field: "created_at", order: "DESC" },
        });
        if (!isCancelled) {
          setVacancias(result.data);
        }
      } catch (error) {
        console.error("No se pudieron cargar las vacancias", error);
      }
    };

    fetchVacancias();
    return () => {
      isCancelled = true;
    };
  }, [dataProvider, record, vacanciaVersion]);

  const vacanciasOrdenadas = useMemo(() => {
    return [...vacancias].sort((a, b) => {
      const fechaA = a.fecha_recibida ? new Date(a.fecha_recibida).getTime() : 0;
      const fechaB = b.fecha_recibida ? new Date(b.fecha_recibida).getTime() : 0;
      if (fechaA === fechaB) {
        return (b.id ?? 0) - (a.id ?? 0);
      }
      return fechaB - fechaA;
    });
  }, [vacancias]);

  const vacanciaActiva = useMemo(() => vacancias.find((vacancia) => vacancia.ciclo_activo), [vacancias]);
  const ultimaVacancia = vacanciaActiva ?? vacanciasOrdenadas[0];

  const diasReparacion = preferCalculated(
    ultimaVacancia?.dias_reparacion,
    ultimaVacancia?.dias_reparacion_calculado
  );
  const diasDisponibles = preferCalculated(
    ultimaVacancia?.dias_disponible,
    ultimaVacancia?.dias_disponible_calculado
  );
  const diasTotales = preferCalculated(
    ultimaVacancia?.dias_totales,
    ultimaVacancia?.dias_totales_calculado
  );

  const metadata = useMemo(
    () => {
      if (!record) return [];
      return [
        { label: "Ambientes", value: record.ambientes ?? "N/D" },
        { label: "Metros2", value: record.metros_cuadrados ?? "N/D", format: "decimal" as const },
        { label: "Valor alquiler", value: record.valor_alquiler, format: "currency" as const },
        { label: "Expensas", value: record.expensas, format: "currency" as const },
        { label: "Fecha ingreso", value: record.fecha_ingreso ?? "Sin registrar" },
        { label: "Vencimiento contrato", value: record.vencimiento_contrato ?? "Sin registrar" },
      ];
    },
    [record]
  );

  const formatNumber = (value: number, format?: "currency" | "decimal") => {
    if (format === "currency") {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(value);
    }

    if (format === "decimal") {
      return new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
    }

    return new Intl.NumberFormat("es-AR").format(value);
  };

  // Early return después de todos los hooks
  if (!record) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{record.nombre}</h1>
          <p className="text-muted-foreground">{record.propietario}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">{record.tipo}</Badge>
            <Badge>{formatEstadoPropiedad(record.estado)}</Badge>
          </div>
        </div>
        {record.id && (
          <ChangeStateDialog
            propiedadId={record.id}
            currentEstado={record.estado}
            estadoFecha={record.estado_fecha}
            onCompleted={() => {
              setVacanciaVersion((version) => version + 1);
            }}
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos de la propiedad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre">
                <TextField source="nombre" />
              </Field>
              <Field label="Tipo">
                <TextField source="tipo" />
              </Field>
              <Field label="Propietario">
                <TextField source="propietario" />
              </Field>
              <Field label="Estado">
                <span>{formatEstadoPropiedad(record.estado)}</span>
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Metricas de vacancia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Metric label="Dias en reparacion" value={diasReparacion} />
            <Metric label="Dias disponible" value={diasDisponibles} />
            <Metric label="Dias totales ciclo" value={diasTotales} />
            <Metric
              label="Ciclo activo"
              value={vacanciaActiva ? "Si" : "No"}
              highlight={vacanciaActiva ? "text-green-600" : "text-muted-foreground"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Caracterizacion y contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            {metadata.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="text-base font-medium">
                  {typeof item.value === "number" ? formatNumber(item.value, item.format) : item.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <VacanciaTimeline vacancia={ultimaVacancia} />
      <CollapsibleSection
        title="Vacancia"
        defaultOpen={false}
        contentPadding="sm"
        className="border"
        contentClassName="p-0"
      >
        <VacanciaHistoryTable vacancias={vacanciasOrdenadas} />
      </CollapsibleSection>

      {record.estado_comentario && (
        <Card>
          <CardHeader>
          <CardTitle>Ultimo comentario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{record.estado_comentario}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <div className="text-base font-medium">{children}</div>
  </div>
);

const Metric = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | number | null;
  highlight?: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-base font-semibold ${highlight ?? ""}`}>{value ?? "Sin datos"}</span>
  </div>
);

const VacanciaHistoryTable = ({ vacancias }: { vacancias: Vacancia[] }) => {
  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-AR");
  };

  const formatDias = (vacancia: Vacancia) => {
    return (
      preferCalculated(vacancia.dias_totales, vacancia.dias_totales_calculado) ??
      "-"
    );
  };

  if (!vacancias.length) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Aun no existen ciclos de vacancia registrados para esta propiedad.
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-x-auto overflow-y-auto">
      <Table className="text-[11px] min-w-[720px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-2 py-1">#</TableHead>
            <TableHead className="px-2 py-1">Estado</TableHead>
            <TableHead className="px-2 py-1">Recibida</TableHead>
            <TableHead className="px-2 py-1">Disp.</TableHead>
            <TableHead className="px-2 py-1">Alquilada</TableHead>
            <TableHead className="px-2 py-1">Retirada</TableHead>
            <TableHead className="px-2 py-1 text-right">Dias</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vacancias.map((vacancia) => (
            <TableRow key={vacancia.id} className="hover:bg-transparent">
              <TableCell className="px-2 py-1 font-semibold">#{vacancia.id}</TableCell>
              <TableCell className="px-2 py-1">
                {vacancia.ciclo_activo ? "Activo" : "Cerrado"}
              </TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_recibida)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_disponible)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_alquilada)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_retirada)}</TableCell>
              <TableCell className="px-2 py-1 text-right">{formatDias(vacancia)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
