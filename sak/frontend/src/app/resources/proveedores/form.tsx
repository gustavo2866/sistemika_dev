"use client";

import { required, email as emailValidator } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { BooleanInput } from "@/components/boolean-input";
import { ReferenceInput } from "@/components/reference-input";
import {
  CompactFormGrid,
  CompactFormSection,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import {
  CONCEPTOS_REFERENCE,
  PROVEEDOR_DEFAULT,
  PROVEEDOR_VALIDATIONS,
} from "./model";

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
              <ReferenceInput
                source="concepto_id"
                reference={CONCEPTOS_REFERENCE.resource}
                label="Concepto (opcional)"
                perPage={CONCEPTOS_REFERENCE.limit}
              >
                <CompactSelectInput optionText="nombre" emptyText="Sin concepto" className="w-full" />
              </ReferenceInput>
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
              <BooleanInput source="activo" label="Activo" />
            </CompactFormSection>
          ),
        },
      ]}
    />
  </SimpleForm>
);
