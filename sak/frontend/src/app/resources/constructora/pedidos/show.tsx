"use client";

import { RecordContextProvider, useRecordContext } from "ra-core";

import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { ReferenceField } from "@/components/reference-field";
import { SelectField } from "@/components/select-field";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PEDIDO_ESTADO_CHOICES,
  PEDIDO_ORIGEN_CHOICES,
  type ConstructoraPedidoDetalle,
} from "./model";

const DetalleItem = ({ detalle }: { detalle: ConstructoraPedidoDetalle }) => (
  <RecordContextProvider value={detalle}>
    <div className="rounded-lg border p-4 space-y-2 md:grid md:grid-cols-4 md:gap-4 md:space-y-0">
      <div className="md:col-span-2">
        <span className="text-xs font-medium text-muted-foreground block">Articulo</span>
        <ReferenceField source="articulo_id" reference="articulos">
          <TextField source="nombre" />
        </ReferenceField>
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Cantidad</span>
        <NumberField source="cantidad" options={{ minimumFractionDigits: 0, maximumFractionDigits: 3 }} />
      </div>
      <div>
        <span className="text-xs font-medium text-muted-foreground block">Unidad</span>
        <TextField source="unidad_medida" />
      </div>
      <div className="md:col-span-2">
        <span className="text-xs font-medium text-muted-foreground block">Descripcion</span>
        <TextField source="descripcion" />
      </div>
      <div className="md:col-span-2">
        <span className="text-xs font-medium text-muted-foreground block">Tipo solicitud</span>
        <ReferenceField source="tipo_solicitud_id" reference="tipos-solicitud">
          <TextField source="nombre" />
        </ReferenceField>
      </div>
    </div>
  </RecordContextProvider>
);

const DetallesSection = () => {
  const record = useRecordContext<{ detalles?: ConstructoraPedidoDetalle[] }>();
  const detalles = Array.isArray(record?.detalles) ? record.detalles : [];

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Lineas</h3>
        <p className="text-sm text-muted-foreground">Materiales solicitados y confirmados.</p>
      </div>
      <Separator />
      {detalles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin lineas cargadas.</p>
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

export const PedidoShow = () => (
  <Show>
    <SimpleShowLayout>
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Pedido</h3>
          <p className="text-sm text-muted-foreground">Datos principales del pedido de obra.</p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Titulo</span>
            <TextField source="titulo" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Estado</span>
            <SelectField source="estado" choices={PEDIDO_ESTADO_CHOICES} />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Origen</span>
            <SelectField source="origen" choices={PEDIDO_ORIGEN_CHOICES} />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground block">Fecha</span>
            <DateField source="created_at" />
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground block">Oportunidad</span>
            <ReferenceField source="oportunidad_id" reference="crm/oportunidades">
              <TextField source="titulo" />
            </ReferenceField>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground block">Observaciones</span>
          <TextField source="observaciones" />
        </div>
      </Card>
      <DetallesSection />
    </SimpleShowLayout>
  </Show>
);

export default PedidoShow;
