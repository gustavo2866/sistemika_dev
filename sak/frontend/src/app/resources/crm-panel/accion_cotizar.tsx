"use client";

import { Target } from "lucide-react";
import { required, useNotify, useRecordContext, useRefresh } from "ra-core";
import { Edit } from "@/components/edit";
import { ResourceTitle } from "@/components/resource-title";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { TextInput } from "@/components/text-input";
import { SaveButton } from "@/components/form";
import { CancelButton } from "@/components/cancel-button";
import { Card } from "@/components/ui/card";
import type { CRMOportunidad } from "../crm-oportunidades/model";
import { AccionOportunidadHeader } from "./accion_header";

const normalizeId = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? Number(numeric) : null;
};

const normalizeNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? numeric : null;
};

export const CRMOportunidadAccionCotizar = () => {
  const notify = useNotify();
  const refresh = useRefresh();

  return (
    <Edit
      resource="crm/oportunidades"
      redirect="/crm/panel"
      mutationMode="pessimistic"
      actions={false}
      transform={(data) => ({
        ...data,
        propiedad_id: normalizeId((data as any).propiedad_id),
        tipo_propiedad_id: normalizeId((data as any).tipo_propiedad_id),
        moneda_id: normalizeId((data as any).moneda_id),
        condicion_pago_id: normalizeId((data as any).condicion_pago_id),
        monto: normalizeNumber((data as any).monto),
        forma_pago_descripcion: (data as any).forma_pago_descripcion?.trim() || null,
        estado: "3-cotiza",
        fecha_estado: new Date().toISOString(),
      })}
      mutationOptions={{
        onSuccess: () => {
          notify("Cotizacion registrada exitosamente", { type: "success" });
          refresh();
        },
      }}
      title={<ResourceTitle icon={Target} text="Cotizar oportunidad" />}
    >
      <AccionCotizarContent />
    </Edit>
  );
};

export default CRMOportunidadAccionCotizar;

const AccionCotizarContent = () => {
  const record = useRecordContext<CRMOportunidad>();

  return (
    <div className="w-full max-w-3xl mr-auto ml-0">
      <SimpleForm
        className="w-full max-w-none"
        toolbar={
          <FormToolbar className="mt-4 rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm md:flex md:items-center md:justify-end md:py-3">
            <div className="flex justify-end gap-2">
              <CancelButton />
              <SaveButton label="Guardar y avanzar" />
            </div>
          </FormToolbar>
        }
      >
        <div className="space-y-4">
          <AccionOportunidadHeader oportunidad={record} />
          <Card className="flex w-full flex-col gap-5 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-5 shadow-lg">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
                <SelectInput optionText="nombre" emptyText="Seleccionar" validate={required()} />
              </ReferenceInput>
              <ReferenceInput
                source="tipo_propiedad_id"
                reference="tipos-propiedad"
                label="Tipo de propiedad"
              >
                <SelectInput optionText="nombre" emptyText="Sin asignar" />
              </ReferenceInput>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ReferenceInput source="moneda_id" reference="monedas" label="Moneda">
                <SelectInput
                  optionText={(record) =>
                    record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre
                  }
                  emptyText="Seleccionar"
                  validate={required()}
                />
              </ReferenceInput>
              <NumberInput source="monto" label="Monto" className="w-full" step="any" validate={required()} />
            </div>
            <ReferenceInput
              source="condicion_pago_id"
              reference="crm/catalogos/condiciones-pago"
              label="Condicion de pago"
            >
              <SelectInput optionText="nombre" emptyText="Sin asignar" />
            </ReferenceInput>
            <TextInput
              source="forma_pago_descripcion"
              label="Detalle forma de pago"
              multiline
              className="w-full"
              placeholder="Notas adicionales"
            />
          </Card>
        </div>
      </SimpleForm>
    </div>
  );
};
