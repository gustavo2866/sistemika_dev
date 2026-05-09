"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormDate,
  FormErrorSummary,
  FormNumber,
  FormReferenceAutocomplete,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import {
  CATEGORIA_CHOICES,
  NOMINA_DEFAULT,
  VALIDATION_RULES,
  nominaSchema,
  type NominaFormValues,
} from "./model";

const DatosPersonalesFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="nombre"
      label="Nombre"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.NOMBRE.MAX_LENGTH}
    />
    <FormText
      source="apellido"
      label="Apellido"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.APELLIDO.MAX_LENGTH}
    />
    <FormText
      source="dni"
      label="DNI"
      validate={required()}
      widthClass="w-full"
      maxLength={VALIDATION_RULES.DNI.MAX_LENGTH}
    />
    <FormDate
      source="fecha_nacimiento"
      label="Fecha de nacimiento"
      widthClass="w-full"
    />
  </div>
);

const DatosLaboralesFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormSelect
      source="categoria"
      label="Categoria"
      choices={CATEGORIA_CHOICES}
      validate={required()}
      widthClass="w-full"
    />
    <FormReferenceAutocomplete
      referenceProps={{ source: "idproyecto", reference: "proyectos" }}
      inputProps={{
        optionText: "nombre",
        label: "Proyecto",
        validate: required(),
      }}
      widthClass="w-full"
    />
    <FormDate
      source="fecha_ingreso"
      label="Fecha de ingreso"
      widthClass="w-full"
    />
    <FormNumber
      source="salario_mensual"
      label="Salario mensual"
      min={0}
      step="0.01"
      widthClass="w-full"
    />
    <div className="md:col-span-2">
      <FormBoolean
        source="activo"
        label="Activo"
        defaultValue
      />
    </div>
  </div>
);

const ContactoFields = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="email"
      label="Email"
      type="email"
      widthClass="w-full"
      maxLength={VALIDATION_RULES.EMAIL.MAX_LENGTH}
    />
    <FormText
      source="telefono"
      label="Telefono"
      widthClass="w-full"
      maxLength={VALIDATION_RULES.TELEFONO.MAX_LENGTH}
    />
    <FormText
      source="url_foto"
      label="URL foto"
      type="url"
      widthClass="w-full md:col-span-2"
      maxLength={VALIDATION_RULES.URL_FOTO.MAX_LENGTH}
    />
    <FormTextarea
      source="direccion"
      label="Direccion"
      rows={3}
      widthClass="w-full"
      className="md:col-span-2 [&_textarea]:min-h-[72px]"
      maxLength={VALIDATION_RULES.DIRECCION.MAX_LENGTH}
    />
  </div>
);

export const NominaForm = () => (
  <SimpleForm<NominaFormValues>
    className="w-full max-w-3xl"
    resolver={zodResolver(nominaSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={NOMINA_DEFAULT}
  >
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Datos personales"
      main={<DatosPersonalesFields />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Datos laborales"
      main={<DatosLaboralesFields />}
      defaultOpen
    />
    <SectionBaseTemplate
      title="Contacto"
      main={<ContactoFields />}
      defaultOpen={false}
    />
  </SimpleForm>
);
