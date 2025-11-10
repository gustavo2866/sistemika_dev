"use client";

import { useMemo } from "react";
import { required } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { SelectInput } from "@/components/select-input";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ComboboxQuery,
  FormLayout,
  FormField,
  FormChoiceSelect,
  FormSimpleSection,
  FormDetailSection,
  FormDetailSectionAddButton,
  FormDetailCardList,
  FormDetailCard,
  FormDetailSectionMinItems,
  FormDetailFormDialog,
  useAutoInitializeField,
  useFormDetailSectionContext,
} from "@/components/forms";
import {
  type Solicitud,
  type SolicitudDetalle,
  TIPO_CHOICES,
  UNIDAD_MEDIDA_CHOICES,
  ARTICULOS_REFERENCE,
  VALIDATION_RULES,
  solicitudCabeceraSchema,
  solicitudDetalleSchema,
} from "./model";

const GENERAL_SUBTITLE_COMMENT_SNIPPET = 25;

const buildGeneralSubtitle = (
  id: number | undefined,
  tipo: string | undefined,
  comentario: string | undefined,
  comentarioSnippetLength: number = GENERAL_SUBTITLE_COMMENT_SNIPPET
): string => {
  const snippet = comentario ? comentario.slice(0, comentarioSnippetLength) : "";
  return [id, tipo, snippet].filter(Boolean).join(" - ") || "Sin datos";
};

const SolicitudDetalleCard = ({ item }: { item: SolicitudDetalle }) => {
  const { getReferenceLabel } = useFormDetailSectionContext();
  const articuloLabel =
    item.articulo_nombre ||
    getReferenceLabel("articulo_id", item.articulo_id) ||
    `ID: ${item.articulo_id}`;

  return (
    <FormDetailCard
      title={articuloLabel}
      subtitle={item.descripcion || "Artículo sin descripción"}
      meta={[
        { label: "Unidad", value: item.unidad_medida || "-" },
        { label: "Cantidad", value: item.cantidad },
      ]}
    />
  );
};

const SolicitudDetalleForm = () => (
  <FormDetailFormDialog
    title={({ action }) =>
      action === "create" ? "Agregar artículo" : "Editar artículo"
    }
    description="Completa los datos del artículo para la solicitud."
  >
    {(detalleForm) => (
      <>
        <FormField
          label="Artículo"
          error={detalleForm.formState.errors.articulo_id}
          required
        >
          <ComboboxQuery
            {...ARTICULOS_REFERENCE}
            value={detalleForm.watch("articulo_id")}
              onChange={(value: string) =>
                detalleForm.setValue("articulo_id", value, {
                  shouldValidate: true,
                })
              }
              placeholder="Selecciona un artículo"
            />
          </FormField>

        <FormField
          label="Descripción"
          error={detalleForm.formState.errors.descripcion}
          required
        >
          <Textarea rows={3} {...detalleForm.register("descripcion")} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormChoiceSelect
            label="Unidad de medida"
            error={detalleForm.formState.errors.unidad_medida}
            required
            choices={UNIDAD_MEDIDA_CHOICES}
            value={detalleForm.watch("unidad_medida")}
            onChange={(value) =>
              detalleForm.setValue("unidad_medida", value, {
                shouldValidate: true,
              })
            }
            placeholder="Selecciona unidad"
          />

            <FormField
              label="Cantidad"
              error={detalleForm.formState.errors.cantidad}
              required
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                {...detalleForm.register("cantidad", { valueAsNumber: true })}
              />
            </FormField>
          </div>
        </>
    )}
  </FormDetailFormDialog>
);

const SolicitudDetalleContent = () => (
  <>
    <FormDetailSectionAddButton label="Agregar artículo" />
    <FormDetailCardList<SolicitudDetalle>
      emptyMessage="Todavía no agregaste artículos."
    >
      {(item) => <SolicitudDetalleCard item={item} />}
    </FormDetailCardList>
    <FormDetailSectionMinItems itemName="artículo" />
    <SolicitudDetalleForm />
  </>
);

const DatosGeneralesContent = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <SelectInput
      source="tipo"
      label="Tipo de solicitud"
      choices={TIPO_CHOICES}
      className="w-full"
      validate={required()}
    />
    <TextInput
      source="fecha_necesidad"
      label="Fecha de necesidad"
      type="date"
      className="w-full"
      validate={required()}
    />
    <ReferenceInput
      source="solicitante_id"
      reference="users"
      label="Solicitante"
    >
      <SelectInput optionText="nombre" className="w-full" validate={required()} />
    </ReferenceInput>
    <TextInput
      source="comentario"
      label="Comentarios"
      multiline
      rows={3}
      className="md:col-span-2"
    />
  </div>
);

const SolicitudFormFields = () => {
  const form = useFormContext<Solicitud>();
  const { control } = form;
  const idValue = useWatch({ control, name: "id" });
  const tipoValue = useWatch({ control, name: "tipo" });
  const comentarioValue = useWatch({ control, name: "comentario" }) || "";

  useAutoInitializeField("solicitante_id", "id", !idValue);

  const generalSubtitle = useMemo(
    () =>
      buildGeneralSubtitle(
        idValue,
        tipoValue,
        comentarioValue,
        GENERAL_SUBTITLE_COMMENT_SNIPPET
      ),
    [idValue, tipoValue, comentarioValue]
  );

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: !idValue,
          children: (
            <FormSimpleSection>
              <DatosGeneralesContent />
            </FormSimpleSection>
          ),
        },
        {
          id: "articulos",
          title: "Artículos seleccionados",
          defaultOpen: true,
          children: (
            <FormDetailSection
              name="detalles"
              schema={solicitudDetalleSchema}
              minItems={VALIDATION_RULES.DETALLE.MIN_ITEMS}
            >
              <SolicitudDetalleContent />
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};

export const Form = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const cabeceraDefaults = useMemo(
    () => solicitudCabeceraSchema.defaults(),
    []
  );
  const defaultValues = useMemo(() => {
    const solicitanteDefault =
      cabeceraDefaults.solicitante_id &&
      cabeceraDefaults.solicitante_id.trim().length > 0
        ? Number(cabeceraDefaults.solicitante_id)
        : undefined;
    return {
      ...cabeceraDefaults,
      fecha_necesidad: cabeceraDefaults.fecha_necesidad || today,
      solicitante_id: solicitanteDefault,
      detalles: [] as SolicitudDetalle[],
    };
  }, [cabeceraDefaults, today]);

  return (
    <SimpleForm
      defaultValues={defaultValues}
    >
      <SolicitudFormFields />
    </SimpleForm>
  );
};
