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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComboboxQuery,
  FormLayout,
  FormField,
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
              <FormDetailSectionAddButton label="Agregar artículo" />

              <FormDetailCardList<SolicitudDetalle>
                emptyMessage="Todavía no agregaste artículos."
              >
                {(item) => <SolicitudDetalleCard item={item} />}
              </FormDetailCardList>

              <FormDetailSectionMinItems itemName="artículo" />

              <FormDetailFormDialog
                title={({ action }) =>
                  action === "create" ? "Agregar artículo" : "Editar artículo"
                }
                description="Completa los datos del artículo para la solicitud."
              >
                {(detalleForm) => {
                  const resolveErrorMessage = (error: unknown) => {
                    if (!error) return undefined;
                    if (typeof error === "string") return error;
                    const maybeMessage =
                      typeof error === "object" && error !== null
                        ? (error as { message?: unknown }).message
                        : undefined;
                    return typeof maybeMessage === "string" ? maybeMessage : undefined;
                  };

                  return (
                  <>
                    <FormField
                      label="Artículo"
                      error={resolveErrorMessage(
                        detalleForm.formState.errors.articulo_id
                      )}
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
                      error={resolveErrorMessage(
                        detalleForm.formState.errors.descripcion
                      )}
                      required
                    >
                      <Textarea rows={3} {...detalleForm.register("descripcion")} />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label="Unidad de medida"
                        error={resolveErrorMessage(
                          detalleForm.formState.errors.unidad_medida
                        )}
                        required
                      >
                        <Select
                          value={detalleForm.watch("unidad_medida")}
                          onValueChange={(value) =>
                            detalleForm.setValue("unidad_medida", value, {
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDAD_MEDIDA_CHOICES.map((choice) => (
                              <SelectItem key={choice.id} value={choice.id}>
                                {choice.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField
                        label="Cantidad"
                        error={resolveErrorMessage(
                          detalleForm.formState.errors.cantidad
                        )}
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
                  );
                }}
              </FormDetailFormDialog>
            </FormDetailSection>
          ),
        },
      ]}
    />
  );
};

export const Form = () => {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <SimpleForm
      defaultValues={{
        tipo: "normal",
        fecha_necesidad: today,
        solicitante_id: undefined,
        comentario: "",
        detalles: [] as SolicitudDetalle[],
      }}
    >
      <SolicitudFormFields />
    </SimpleForm>
  );
};
