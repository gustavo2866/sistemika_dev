"use client";

import { required, email as emailValidator, useGetOne } from "ra-core";
import { useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactComboboxQuery,
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import {
  ARTICULOS_REFERENCE,
  CONCEPTOS_REFERENCE,
  DEPARTAMENTOS_REFERENCE,
  METODOS_PAGO_REFERENCE,
  PROVEEDOR_DEFAULT,
  PROVEEDOR_VALIDATIONS,
  TIPOS_SOLICITUD_REFERENCE,
  USERS_REFERENCE,
} from "./model";

const DefaultArticuloField = () => {
  const tipoSolicitudValue = useWatch({ name: "default_tipo_solicitud_id" });
  const tipoSolicitudId = Number(tipoSolicitudValue);
  const tipoSolicitudIdValid = Number.isFinite(tipoSolicitudId) && tipoSolicitudId > 0;
  const { data: tipoSolicitud } = useGetOne(
    "tipos-solicitud",
    { id: tipoSolicitudIdValid ? tipoSolicitudId : 0 },
    { enabled: tipoSolicitudIdValid }
  );
  const tipoArticuloFilterId = (tipoSolicitud as { tipo_articulo_filter_id?: number } | undefined)
    ?.tipo_articulo_filter_id;
  const articuloFilter =
    typeof tipoArticuloFilterId === "number"
      ? { tipo_articulo_id: tipoArticuloFilterId }
      : undefined;

  return (
    <CompactFormField label="Articulo default">
      <CompactComboboxQuery
        {...ARTICULOS_REFERENCE}
        source="default_articulos_id"
        placeholder="Selecciona un artÃ­culo"
        className="w-full"
        clearable
        filter={articuloFilter}
        dependsOn={tipoArticuloFilterId ?? "all"}
      />
    </CompactFormField>
  );
};

export const ProveedorForm = () => (
  <SimpleForm className="w-full max-w-4xl" defaultValues={PROVEEDOR_DEFAULT}>
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          defaultOpen: true,
          contentPadding: "none",
          contentClassName: "space-y-3 px-4 py-3",
          children: (
            <CompactFormSection>
              <CompactFormGrid columns="two">
                <CompactTextInput
                  source="nombre"
                  label="Nombre"
                  validate={required()}
                  maxLength={PROVEEDOR_VALIDATIONS.NOMBRE_MAX}
                />
                <CompactTextInput
                  source="razon_social"
                  label="Razon social"
                  validate={required()}
                  maxLength={PROVEEDOR_VALIDATIONS.RAZON_SOCIAL_MAX}
                />
              </CompactFormGrid>
              <CompactTextInput
                source="cuit"
                label="CUIT"
                validate={required()}
                maxLength={PROVEEDOR_VALIDATIONS.CUIT_MAX}
              />
              <CompactFormGrid columns="two">
                <CompactTextInput
                  source="telefono"
                  label="Telefono"
                  maxLength={PROVEEDOR_VALIDATIONS.TELEFONO_MAX}
                />
                <CompactTextInput
                  source="email"
                  label="Email"
                  type="email"
                  validate={emailValidator()}
                  maxLength={PROVEEDOR_VALIDATIONS.EMAIL_MAX}
                />
              </CompactFormGrid>
              <CompactTextInput
                source="direccion"
                label="Direccion"
                maxLength={PROVEEDOR_VALIDATIONS.DIRECCION_MAX}
              />
              <BooleanInput source="activo" label="Activo" />
            </CompactFormSection>
          ),
        },
        {
          id: "datos-bancarios",
          title: "Datos bancarios",
          defaultOpen: false,
          contentPadding: "none",
          contentClassName: "space-y-3 px-4 py-3",
          children: (
            <CompactFormSection>
              <CompactFormGrid columns="two">
                <CompactTextInput
                  source="cbu"
                  label="CBU"
                  maxLength={PROVEEDOR_VALIDATIONS.CBU_MAX}
                />
                <CompactTextInput
                  source="alias_bancario"
                  label="Alias bancario"
                  maxLength={PROVEEDOR_VALIDATIONS.ALIAS_BANCARIO_MAX}
                />
              </CompactFormGrid>
            </CompactFormSection>
          ),
        },
        {
          id: "defaults-compra",
          title: "Defaults de compra",
          defaultOpen: false,
          contentPadding: "none",
          contentClassName: "space-y-3 px-4 py-3",
          children: (
            <CompactFormSection>
              <CompactFormGrid columns="two">
                <ReferenceInput
                  source="default_tipo_solicitud_id"
                  reference={TIPOS_SOLICITUD_REFERENCE.resource}
                  label="Tipo de solicitud"
                  perPage={TIPOS_SOLICITUD_REFERENCE.limit}
                >
                  <CompactSelectInput optionText="nombre" emptyText="Sin default" className="w-full" />
                </ReferenceInput>
                <ReferenceInput
                  source="default_departamento_id"
                  reference={DEPARTAMENTOS_REFERENCE.resource}
                  label="Departamento"
                  perPage={DEPARTAMENTOS_REFERENCE.limit}
                >
                  <CompactSelectInput optionText="nombre" emptyText="Sin default" className="w-full" />
                </ReferenceInput>
              </CompactFormGrid>
              <ReferenceInput
                source="concepto_id"
                reference={CONCEPTOS_REFERENCE.resource}
                label="Concepto (opcional)"
                perPage={CONCEPTOS_REFERENCE.limit}
              >
                <CompactSelectInput optionText="nombre" emptyText="Sin concepto" className="w-full" />
              </ReferenceInput>
              <DefaultArticuloField />
              <CompactFormGrid columns="two">
                <ReferenceInput
                  source="default_metodo_pago_id"
                  reference={METODOS_PAGO_REFERENCE.resource}
                  label="Metodo de pago"
                  perPage={METODOS_PAGO_REFERENCE.limit}
                >
                  <CompactSelectInput optionText="nombre" emptyText="Sin default" className="w-full" />
                </ReferenceInput>
                <ReferenceInput
                  source="default_usuario_responsable_id"
                  reference={USERS_REFERENCE.resource}
                  label="Usuario responsable"
                >
                  <CompactSelectInput optionText="nombre" emptyText="Sin default" className="w-full" />
                </ReferenceInput>
              </CompactFormGrid>
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
);
