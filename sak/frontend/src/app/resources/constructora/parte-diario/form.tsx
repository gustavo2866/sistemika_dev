"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormErrorSummary,
  FormSelect,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ArrayInput } from "@/components/array-input";
import { NumberInput } from "@/components/number-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { TextInput } from "@/components/text-input";
import { estadoParteChoices, tipoLicenciaChoices } from "./constants";
import {
  PARTE_DIARIO_DEFAULTS,
  parteDiarioSchema,
  VALIDATION_RULES,
  type ParteDiarioFormValues,
} from "./model";

const ParteDiarioMainFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <ReferenceInput source="idproyecto" reference="proyectos" label="Proyecto">
      <SelectInput
        optionText="nombre"
        className="w-full"
        validate={required()}
      />
    </ReferenceInput>
    <FormDate
      source="fecha"
      label="Fecha"
      validate={required()}
      widthClass="w-full"
    />
    <FormSelect
      source="estado"
      label="Estado"
      choices={estadoParteChoices}
      validate={required()}
      widthClass="w-full"
    />
    <FormTextarea
      source="descripcion"
      label="Descripcion"
      widthClass="w-full md:col-span-2"
      className="md:col-span-2 [&_textarea]:min-h-[80px]"
      maxLength={VALIDATION_RULES.DESCRIPCION.MAX_LENGTH}
    />
  </div>
);

const ParteDiarioMainHelp = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Selecciona el proyecto, registra la fecha del parte y resume las novedades
    generales de la jornada.
  </div>
);

const ParteDiarioDetalleFields = () => (
  <ArrayInput source="detalles" label={false}>
    <SimpleFormIterator inline={false} className="space-y-3">
      <TextInput source="id" type="hidden" label={false} className="hidden" />
      <div className="grid gap-3 md:grid-cols-2">
        <ReferenceInput source="idnomina" reference="nominas" label="Empleado">
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
          min={VALIDATION_RULES.HORAS.MIN}
          max={VALIDATION_RULES.HORAS.MAX}
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
          label="Descripcion"
          placeholder="Tareas realizadas o nota"
          className="w-full"
          maxLength={VALIDATION_RULES.DETALLE_DESCRIPCION.MAX_LENGTH}
        />
      </div>
    </SimpleFormIterator>
  </ArrayInput>
);

const ParteDiarioDetalleHelp = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Registra una linea por empleado con horas trabajadas o licencia. Puedes
    dejar la licencia vacia cuando la jornada fue normal.
  </div>
);

export const ParteDiarioForm = () => (
  <SimpleForm<ParteDiarioFormValues>
    className="w-full max-w-5xl"
    resolver={zodResolver(parteDiarioSchema) as any}
    toolbar={<FormOrderToolbar saveProps={{ variant: "secondary" }} />}
    defaultValues={PARTE_DIARIO_DEFAULTS}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Informacion general"
      main={<ParteDiarioMainFields />}
      optional={<ParteDiarioMainHelp />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Detalle de horas"
      main={<ParteDiarioDetalleFields />}
      optional={<ParteDiarioDetalleHelp />}
      defaultOpen
    />
  </SimpleForm>
);
