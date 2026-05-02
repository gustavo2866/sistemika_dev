"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";
import { useRecordContext } from "ra-core";
import { computeProyPresupuestoTotal, type ProyPresupuesto } from "./model";

const ProyPresupuestoResumen = () => {
  const record = useRecordContext<ProyPresupuesto>();
  const total = computeProyPresupuestoTotal(record ?? {});

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Presupuesto</h3>
        <p className="text-sm text-muted-foreground">
          Distribucion economica y metrica del presupuesto por proyecto.
        </p>
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Proyecto</span>
          <ReferenceField source="proyecto_id" reference="proyectos" link={false}>
            <TextField source="nombre" />
          </ReferenceField>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Fecha</span>
          <DateField source="fecha" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <span className="block text-xs font-medium text-muted-foreground">MO propia</span>
          <NumberField source="mo_propia" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">MO terceros</span>
          <NumberField source="mo_terceros" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Materiales</span>
          <NumberField source="materiales" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Herramientas</span>
          <NumberField source="herramientas" options={{ style: "currency", currency: "ARS" }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Horas</span>
          <NumberField source="horas" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Metros</span>
          <NumberField source="metros" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Importe</span>
          <NumberField
            source="importe"
            record={{ importe: total }}
            options={{ style: "currency", currency: "ARS" }}
          />
        </div>
      </div>
      {record?.descripcion && (
        <div>
          <span className="block text-xs font-medium text-muted-foreground">Descripcion</span>
          <p className="text-sm">{record.descripcion}</p>
        </div>
      )}
    </Card>
  );
};

export const ProyPresupuestoShow = () => (
  <Show>
    <SimpleShowLayout>
      <ProyPresupuestoResumen />
    </SimpleShowLayout>
  </Show>
);
