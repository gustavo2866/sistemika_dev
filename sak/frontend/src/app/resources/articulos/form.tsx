"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { ReferenceInput } from "@/components/reference-input";
import { FormOrderToolbar } from "@/components/forms";
import {
  FormBoolean,
  FormNumber,
  FormSelect,
  FormText,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import {
  ARTICULO_DEFAULTS,
  ARTICULO_RULES,
  articuloSchema,
  type ArticuloFormValues,
} from "./model";

const ArticuloMainFields = () => (
  <div className="flex flex-col gap-2">
    <div className="grid gap-2 md:grid-cols-2">
      <FormText
        source="nombre"
        label="Nombre"
        validate={required()}
        widthClass="w-full"
        maxLength={ARTICULO_RULES.NOMBRE.MAX_LENGTH}
      />
      <ReferenceInput
        source="tipo_articulo_id"
        reference="tipos-articulo"
        filter={{ activo: true }}
        perPage={200}
      >
        <FormSelect
          optionText="nombre"
          label="Tipos de articulo"
          widthClass="w-full"
          emptyText="Sin tipo"
        />
      </ReferenceInput>
      <FormText
        source="unidad_medida"
        label="Unidad de medida"
        validate={required()}
        widthClass="w-full"
        maxLength={ARTICULO_RULES.UNIDAD_MEDIDA.MAX_LENGTH}
      />
      <FormText
        source="marca"
        label="Marca"
        widthClass="w-full"
        maxLength={ARTICULO_RULES.MARCA.MAX_LENGTH}
      />
      <FormText
        source="sku"
        label="SKU"
        widthClass="w-full"
        maxLength={ARTICULO_RULES.SKU.MAX_LENGTH}
      />
      <FormNumber
        source="precio"
        label="Precio"
        step={0.01}
        validate={required()}
        widthClass="w-full"
        min={0}
      />
      <ReferenceInput
        source="proveedor_id"
        reference="proveedores"
        label="Proveedor (opcional)"
      >
        <FormSelect
          optionText="nombre"
          label="Proveedor (opcional)"
          widthClass="w-full"
          emptyText="Sin proveedor"
        />
      </ReferenceInput>
    </div>
    <div className="flex flex-wrap gap-4 pt-1">
      <FormBoolean source="activo" label="Activo" defaultValue />
      <FormBoolean source="generico" label="Generico" defaultValue={false} />
    </div>
  </div>
);

export const ArticuloForm = () => (
  <SimpleForm<ArticuloFormValues>
    className="w-full max-w-2xl"
    resolver={zodResolver(articuloSchema) as any}
    toolbar={<FormOrderToolbar />}
    defaultValues={ARTICULO_DEFAULTS}
  >
    <SectionBaseTemplate
      title="Datos del articulo"
      main={<ArticuloMainFields />}
      defaultOpen
    />
  </SimpleForm>
);
