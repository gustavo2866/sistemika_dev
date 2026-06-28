"use client";

import { RecordContextProvider, useRecordContext } from "ra-core";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { DateField } from "@/components/date-field";
import { ReferenceField } from "@/components/reference-field";
import { NumberField } from "@/components/number-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FormOrderEditButton } from "@/components/forms/form_order";
import {
  getEstadoTarjaBadgeClass,
  getEstadoTarjaLabel,
  type TarjaDetalle,
  type TarjaNovedad,
  type TarjaRecord,
} from "./model";

const FieldBlock = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <span className="block text-xs font-medium text-muted-foreground">{label}</span>
    <div className="text-sm text-foreground">{children}</div>
  </div>
);

const DetalleItem = ({ detalle }: { detalle: TarjaDetalle }) => (
  <RecordContextProvider value={detalle}>
    <div className="grid gap-3 rounded-lg border p-3 text-sm md:grid-cols-[1fr_100px_120px_80px_1fr]">
      <FieldBlock label="Empleado">
        <ReferenceField source="idnomina" reference="nominas" link={false}>
          <TextField source="nombre" />
        </ReferenceField>
      </FieldBlock>
      <FieldBlock label="Fecha">
        <DateField source="fecha" />
      </FieldBlock>
      <FieldBlock label="Estado">
        <ReferenceField source="idestado" reference="parte-diario-estados" link={false} empty="-">
          <TextField source="nombre" />
        </ReferenceField>
      </FieldBlock>
      <FieldBlock label="Horas">
        <NumberField
          source="horas"
          options={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
        />
      </FieldBlock>
      <FieldBlock label="Descripcion">
        <TextField source="descripcion" empty="-" />
      </FieldBlock>
    </div>
  </RecordContextProvider>
);

const DetallesSection = () => {
  const record = useRecordContext<TarjaRecord>();
  const detalles = Array.isArray(record?.detalles) ? record.detalles : [];

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-base font-semibold">Detalle</h3>
        <p className="text-xs text-muted-foreground">
          Registros de empleados asociados a la tarja.
        </p>
      </div>
      <Separator />
      {detalles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros cargados.</p>
      ) : (
        <div className="space-y-2">
          {detalles.map((detalle, index) => (
            <DetalleItem detalle={detalle} key={detalle.id ?? `detalle-${index}`} />
          ))}
        </div>
      )}
    </Card>
  );
};

const NovedadesSection = () => {
  const record = useRecordContext<TarjaRecord>();
  const novedades = Array.isArray(record?.novedades) ? record.novedades : [];

  if (novedades.length === 0) {
    return null;
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="text-base font-semibold">Novedades</h3>
      </div>
      <Separator />
      <div className="space-y-2">
        {novedades.map((novedad: TarjaNovedad, index) => (
          <RecordContextProvider value={novedad} key={novedad.id ?? `novedad-${index}`}>
            <div className="grid gap-3 rounded-lg border p-3 text-sm md:grid-cols-4">
              <FieldBlock label="Hs enf. justif.">
                <NumberField source="horas_enfermedad_justif" />
              </FieldBlock>
              <FieldBlock label="Presentismo">
                <NumberField source="presentismo" />
              </FieldBlock>
              <FieldBlock label="Premio">
                <NumberField source="premio" />
              </FieldBlock>
              <FieldBlock label="Observaciones">
                <TextField source="observaciones" empty="-" />
              </FieldBlock>
            </div>
          </RecordContextProvider>
        ))}
      </div>
    </Card>
  );
};

const EstadoTarjaShowField = () => {
  const record = useRecordContext<TarjaRecord>();
  const estado = record?.estado;

  return (
    <Badge
      variant="secondary"
      className={`px-2 py-0.5 text-[11px] font-medium ${getEstadoTarjaBadgeClass(estado)}`}
    >
      {getEstadoTarjaLabel(estado)}
    </Badge>
  );
};

export const TarjaShow = () => (
  <Show
    className="w-full max-w-5xl"
    title="Tarja"
    actions={<FormOrderEditButton />}
  >
    <SimpleShowLayout>
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold">Informacion general</h3>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldBlock label="Proyecto">
            <ReferenceField source="idproyecto" reference="proyectos" link={false}>
              <TextField source="nombre" />
            </ReferenceField>
          </FieldBlock>
          <FieldBlock label="Contacto">
            <ReferenceField source="contacto_id" reference="crm/contactos" link={false}>
              <TextField source="nombre_completo" />
            </ReferenceField>
          </FieldBlock>
          <FieldBlock label="Estado">
            <EstadoTarjaShowField />
          </FieldBlock>
          <FieldBlock label="Inicio">
            <DateField source="fechainicio" />
          </FieldBlock>
          <FieldBlock label="Final">
            <DateField source="fechafinal" />
          </FieldBlock>
          <FieldBlock label="Descripcion" className="md:col-span-2">
            <TextField source="descripcion" empty="-" />
          </FieldBlock>
        </div>
      </Card>
      <DetallesSection />
      <NovedadesSection />
    </SimpleShowLayout>
  </Show>
);

export default TarjaShow;
