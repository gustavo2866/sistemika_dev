"use client";

import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { estadoParteChoices, tipoLicenciaChoices } from "./constants";

export const ParteDiarioForm = () => (
  <SimpleForm className="w-full max-w-5xl space-y-6" defaultValues={{ detalles: [] }}>
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Información general</h3>
        <p className="text-sm text-muted-foreground">
          Selecciona el proyecto y describe las novedades del día.
        </p>
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2">
        <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
          <SelectInput optionText="nombre" className="w-full" validate={required()} />
        </ReferenceInput>
        <TextInput
          source="fecha"
          label="Fecha"
          type="date"
          validate={required()}
          className="w-full"
        />
        <SelectInput
          source="estado"
          label="Estado"
          choices={estadoParteChoices}
          validate={required()}
          className="w-full"
        />
      </div>
      <TextInput
        source="descripcion"
        label="Descripción"
        multiline
        rows={3}
        className="w-full"
      />
    </Card>

    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Detalle de horas</h3>
        <p className="text-sm text-muted-foreground">
          Registra las horas trabajadas o licencias para cada integrante.
        </p>
      </div>
      <Separator />
      <ArrayInput source="detalles" label={false}>
        <SimpleFormIterator inline={false} className="space-y-3">
          <TextInput source="id" type="hidden" label={false} className="hidden" />
          <div className="grid gap-3 md:grid-cols-2">
            <ReferenceInput
              source="idnomina"
              reference="nominas"
              label="Empleado"
            >
              <SelectInput
                optionText="nombre"
                className="w-full"
                emptyText="Seleccionar"
                validate={required()}
              />
            </ReferenceInput>
            <NumberInput
              source="horas"
              label="Horas"
              step={0.25}
              min={0}
              validate={required()}
              className="w-full"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SelectInput
              source="tipolicencia"
              label="Tipo de licencia"
              choices={tipoLicenciaChoices}
              emptyText="Sin licencia"
              className="w-full"
            />
            <TextInput
              source="descripcion"
              label="Descripción"
              placeholder="Tareas realizadas o nota"
              className="w-full"
            />
          </div>
        </SimpleFormIterator>
      </ArrayInput>
    </Card>
  </SimpleForm>
);
