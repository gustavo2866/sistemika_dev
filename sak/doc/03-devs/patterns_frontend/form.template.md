# form.template

Copiar y renombrar como `frontend/src/app/resources/<entidad>/form.tsx`. Ajustar campos e imports según el dominio.

```tsx
"use client";

/**
 * Plantilla base del formulario reutilizable (<Form />) para Create/Edit.
 */

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { SimpleForm, FormToolbar } from "@/components/simple-form";
import {
  FormLayout,
  FormSimpleSection,
  FormField,
  FormDetailSection,
  FormDetailCardList,
  FormDetailCard,
  FormDetailSectionAddButton,
  FormDetailFormDialog,
  useFormDetailSectionContext,
} from "@/components/forms";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import type { MyEntity, MyEntityDetail, MyEntityDetailFormValues } from "./model";
import {
  MY_ENTITY_STATUS_CHOICES,
  MY_ENTITY_DETAIL_DEFAULT_VALUES,
  myEntitySchema,
  myEntityDetailSchema,
} from "./model";

const FormDetailCardPreview = ({ item }: { item: MyEntityDetail }) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const relatedLabel =
    getReferenceLabel("relacionado_id", item.relacionado_id) ||
    (item.relacionado_id ? `ID: ${item.relacionado_id}` : "Sin relacion");

  return (
    <FormDetailCard
      title={item.descripcion || "Detalle sin descripcion"}
      subtitle={relatedLabel}
      meta={[
        { label: "Cantidad", value: item.cantidad },
        { label: "Precio", value: item.precio },
        { label: "Importe", value: item.cantidad * item.precio },
      ]}
    />
  );
};

export const Form = () => {
  const form = useFormContext<MyEntity>();
  const comentarioLength = form.watch("comentario")?.length ?? 0;

  const footerNote = useMemo(
    () => `Comentario: ${comentarioLength}/500 caracteres`,
    [comentarioLength]
  );

  return (
    <SimpleForm<MyEntity>
      resolver={myEntitySchema.resolver}
      defaultValues={{ detalles: [] }}
      toolbar={<FormToolbar />}
    >
      <FormLayout>
        <FormSimpleSection title="Datos generales" columns={2}>
          <FormField>
            <TextInput source="nombre" label="Nombre" isRequired fullWidth />
          </FormField>
          <FormField>
            <SelectInput source="estado" label="Estado" choices={MY_ENTITY_STATUS_CHOICES} />
          </FormField>
          <FormField>
            <ReferenceInput source="responsable_id" reference="users" label="Responsable">
              <SelectInput optionText="nombre" />
            </ReferenceInput>
          </FormField>
          <FormField className="col-span-2">
            <Textarea
              {...form.register("comentario")}
              placeholder="Notas u observaciones"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">{footerNote}</p>
          </FormField>
        </FormSimpleSection>

        <FormDetailSection<MyEntity, MyEntityDetailFormValues>
          title="Detalles"
          name="detalles"
          minItems={1}
          defaultItem={MY_ENTITY_DETAIL_DEFAULT_VALUES}
          schema={myEntityDetailSchema}
        >
          <FormDetailSectionAddButton>Agregar detalle</FormDetailSectionAddButton>
          <FormDetailCardList<MyEntityDetail>
            renderItem={(item) => <FormDetailCardPreview item={item} />}
          />
          <FormDetailFormDialog
            title="Detalle"
            render={({ register }) => (
              <div className="space-y-4">
                <TextInput source="descripcion" label="Descripcion" register={register} />
                <TextInput source="cantidad" label="Cantidad" type="number" register={register} />
                <TextInput source="precio" label="Precio" type="number" step="0.01" register={register} />
                <ReferenceInput source="relacionado_id" reference="related-resource" label="Relacion">
                  <SelectInput optionText="nombre" />
                </ReferenceInput>
              </div>
            )}
          />
        </FormDetailSection>
      </FormLayout>
    </SimpleForm>
  );
};
```
