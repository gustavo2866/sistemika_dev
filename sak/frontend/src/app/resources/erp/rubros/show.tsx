"use client";

import { RecordContextProvider, useRecordContext } from "ra-core";

import { FormOrderEditButton } from "@/components/forms/form_order";
import { NumberField } from "@/components/number-field";
import { Show } from "@/components/show";
import { SimpleShowLayout } from "@/components/simple-show-layout";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ErpCuenta, ErpRubro } from "./model";

const activoBadgeClass = (activo?: boolean | string | number | null) =>
  activo === false || activo === "false" || activo === 0 || activo === "0"
    ? "bg-zinc-100 text-zinc-800"
    : "bg-emerald-100 text-emerald-800";

const ActivoBadge = ({ value }: { value?: boolean | string | number | null }) => {
  const isInactive =
    value === false || value === "false" || value === 0 || value === "0";
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-md px-2 py-0.5 text-[10px]", activoBadgeClass(value))}
    >
      {isInactive ? "Inactivo" : "Activo"}
    </Badge>
  );
};

const CuentasSection = () => {
  const record = useRecordContext<ErpRubro>();
  const cuentas = Array.isArray(record?.cuentas) ? record.cuentas : [];

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h3 className="text-lg font-semibold">Cuentas</h3>
        <p className="text-sm text-muted-foreground">Cuentas contables asociadas al rubro.</p>
      </div>
      <Separator />
      {cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cuentas cargadas.</p>
      ) : (
        <div className="space-y-3">
          {cuentas.map((cuenta, index) => (
            <CuentaItem cuenta={cuenta} key={cuenta.id ?? `cuenta-${index}`} />
          ))}
        </div>
      )}
    </Card>
  );
};

const CuentaItem = ({ cuenta }: { cuenta: ErpCuenta }) => (
  <RecordContextProvider value={cuenta}>
    <div className="rounded-lg border p-4 md:grid md:grid-cols-[96px_150px_minmax(0,1fr)_90px] md:gap-4">
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Nro.</span>
        <NumberField source="nro_cuenta" />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Codigo</span>
        <TextField source="cod_cuenta" />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Descripcion</span>
        <TextField source="descripcion" />
      </div>
      <div>
        <span className="block text-xs font-medium text-muted-foreground">Estado</span>
        <ActivoBadge value={cuenta.activo} />
      </div>
    </div>
  </RecordContextProvider>
);

export const ErpRubroShow = () => (
  <Show
    title="Rubro ERP"
    actions={<FormOrderEditButton />}
    className="w-full max-w-3xl"
  >
    <SimpleShowLayout>
      <Card className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold">Rubro</h3>
          <p className="text-sm text-muted-foreground">Datos principales del rubro ERP.</p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="block text-xs font-medium text-muted-foreground">Nombre</span>
            <TextField source="nombre" />
          </div>
          <div>
            <span className="block text-xs font-medium text-muted-foreground">Estado</span>
            <EstadoRubro />
          </div>
        </div>
      </Card>
      <CuentasSection />
    </SimpleShowLayout>
  </Show>
);

const EstadoRubro = () => {
  const record = useRecordContext<ErpRubro>();
  return <ActivoBadge value={record?.activo} />;
};

