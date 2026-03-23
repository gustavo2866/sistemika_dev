"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { RecordContextProvider, useRecordContext } from "ra-core";
import {
  computeProyectoPresupuestoTotal,
  getProyectoHorasTotales,
  getProyectoUltimoAvance,
} from "./model";

type ProyectoAvanceRecord = {
  id?: number | string;
  horas?: number;
  avance?: number;
  comentario?: string | null;
  fecha_registracion?: string | null;
};

const ProyectoAvanceItem = ({ avance }: { avance: ProyectoAvanceRecord }) => (
  <RecordContextProvider value={avance}>
    <div className="rounded-lg border p-4 space-y-2 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Fecha</span>
        <DateField source="fecha_registracion" />
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Horas</span>
        <NumberField source="horas" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Avance</span>
        <NumberField source="avance" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
        <span className="ml-1">%</span>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Comentario</span>
        <TextField source="comentario" />
      </div>
    </div>
  </RecordContextProvider>
);

const ProyectoAvancesSection = () => {
  const record = useRecordContext<{ avances?: ProyectoAvanceRecord[] }>();
  const avances = Array.isArray(record?.avances) ? record.avances : [];
  const horasTotales = getProyectoHorasTotales(avances);
  const ultimoAvance = getProyectoUltimoAvance(avances);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Avances</h3>
        <p className="text-sm text-muted-foreground">
          Historial de registraciones y porcentaje de avance del proyecto.
        </p>
      </div>
      <Separator />
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          Horas totales:{" "}
          <span className="font-medium text-foreground">{horasTotales}</span>
        </span>
        <span>
          Ultimo avance:{" "}
          <span className="font-medium text-foreground">{ultimoAvance}%</span>
        </span>
      </div>
      {avances.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin avances cargados.</p>
      ) : (
        <div className="space-y-3">
          {avances.map((avance, index) => (
            <ProyectoAvanceItem avance={avance} key={avance.id ?? `avance-${index}`} />
          ))}
        </div>
      )}
    </Card>
  );
};

const ProyectoResumenEconomico = () => {
  const record = useRecordContext();
  const presupuesto = computeProyectoPresupuestoTotal(record as any);

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Resumen economico</h3>
        <p className="text-sm text-muted-foreground">
          Presupuesto proyectado e ingresos esperados.
        </p>
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Presupuesto total</span>
          <NumberField
            source="presupuesto_total"
            record={{ presupuesto_total: presupuesto }}
            options={{ style: "currency", currency: "ARS" }}
          />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Ingresos</span>
          <NumberField source="ingresos" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Superficie %</span>
          <NumberField source="superficie" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Materiales</span>
          <NumberField source="importe_mat" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Mano de obra</span>
          <NumberField source="importe_mo" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Terceros</span>
          <NumberField source="terceros" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Herramientas</span>
          <NumberField source="herramientas" options={{ style: "currency", currency: "ARS" }} />
        </div>
      </div>
    </Card>
  );
};

export const ProyectoShow = () => (
  <Show>
    <SimpleShowLayout>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Cabecera</h3>
          <p className="text-sm text-muted-foreground">
            Datos principales del proyecto y su contexto operativo.
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Nombre</span>
            <TextField source="nombre" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Estado</span>
            <TextField source="estado" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Fecha de inicio</span>
            <DateField source="fecha_inicio" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Fecha final</span>
            <DateField source="fecha_final" />
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground block">Centro de costo</span>
            <NumberField
              source="centro_costo"
              options={{ maximumFractionDigits: 0 }}
            />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Comentario</span>
          <TextField source="comentario" />
        </div>
      </Card>
      <ProyectoResumenEconomico />
      <ProyectoAvancesSection />
    </SimpleShowLayout>
  </Show>
);
