"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { TextField } from "@/components/text-field";

const ProyectoAvanceResumen = () => (
  <Card className="space-y-4 p-6">
    <div>
      <h3 className="text-lg font-semibold">Certificado</h3>
      <p className="text-sm text-muted-foreground">
        Registro de avance y horas imputadas por proyecto.
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
        <DateField source="fecha_registracion" />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Avance</span>
        <NumberField source="avance" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Horas</span>
        <NumberField source="horas" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Importe</span>
        <NumberField source="importe" options={{ style: "currency", currency: "ARS" }} />
      </div>
    </div>
    <div>
      <span className="block text-xs font-medium text-muted-foreground">Comentario</span>
      <TextField source="comentario" className="whitespace-pre-wrap" />
    </div>
  </Card>
);

export const ProyectoAvanceShow = () => (
  <Show>
    <SimpleShowLayout>
      <ProyectoAvanceResumen />
    </SimpleShowLayout>
  </Show>
);
