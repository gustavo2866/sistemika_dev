"use client";

import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { ReferenceField } from "@/components/reference-field";
import { NumberField } from "@/components/number-field";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RecordContextProvider, useRecordContext } from "ra-core";
import { estadoParteChoices, tipoLicenciaChoices } from "./constants";

type DetalleRecord = {
  id?: number;
  idnomina?: number;
  horas?: number;
  tipolicencia?: string | null;
  descripcion?: string | null;
};

const DetalleItem = ({ detalle }: { detalle: DetalleRecord }) => (
  <RecordContextProvider value={detalle}>
    <div className="rounded-lg border p-4 space-y-2 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Empleado</span>
        <ReferenceField source="idnomina" reference="nominas">
          <TextField source="nombre" />
        </ReferenceField>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Horas</span>
        <NumberField source="horas" options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }} />
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Licencia</span>
        <SelectField source="tipolicencia" choices={tipoLicenciaChoices} empty="Sin licencia" />
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Descripción</span>
        <TextField source="descripcion" />
      </div>
    </div>
  </RecordContextProvider>
);

const DetallesSection = () => {
  const record = useRecordContext<{ detalles?: DetalleRecord[] }>();
  const detalles = Array.isArray(record?.detalles) ? record!.detalles : [];

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Detalle de horas</h3>
        <p className="text-sm text-muted-foreground">
          Horas registradas y licencias asignadas a cada integrante del equipo.
        </p>
      </div>
      <Separator />
      {detalles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros cargados.</p>
      ) : (
        <div className="space-y-3">
          {detalles.map((detalle, index) => (
            <DetalleItem detalle={detalle} key={detalle.id ?? `detalle-${index}`} />
          ))}
        </div>
      )}
    </Card>
  );
};

export const ParteDiarioShow = () => (
  <Show>
    <SimpleShowLayout>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Información general</h3>
          <p className="text-sm text-muted-foreground">
            Datos principales del parte diario.
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Fecha</span>
            <DateField source="fecha" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Estado</span>
            <SelectField source="estado" choices={estadoParteChoices} />
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground block">Proyecto</span>
            <ReferenceField source="idproyecto" reference="proyectos">
              <TextField source="nombre" />
            </ReferenceField>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Descripción</span>
          <TextField source="descripcion" />
        </div>
      </Card>
      <DetallesSection />
    </SimpleShowLayout>
  </Show>
);

export default ParteDiarioShow;
