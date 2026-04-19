"use client";
import { useEffect } from "react";
import { required, useGetList } from "ra-core";
import { useRecordContext } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ReferenceInput } from "@/components/reference-input";
import {
  FormErrorSummary,
  FormOrderToolbar,
  FormSelect,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
  useIdentityId,
} from "@/components/forms/form_order";

import {
  CRM_CONTACTO_DEFAULTS,
  CRM_CONTACTO_VALIDATIONS,
  type CRMContacto,
  type CRMContactoFormValues,
} from "./model";

// Sincroniza el responsable por defecto con el usuario autenticado al crear un contacto.
const ResponsableDefaultSync = () => {
  const record = useRecordContext<CRMContacto>();
  const { identityId } = useIdentityId();
  const { setValue } = useFormContext<CRMContactoFormValues>();
  const responsableId = useWatch({ name: "responsable_id" });

  useEffect(() => {
    if (record?.id || !identityId || responsableId) return;
    setValue("responsable_id", identityId, { shouldDirty: false });
  }, [identityId, record?.id, responsableId, setValue]);

  return null;
};

// Asigna "Inmobiliaria" como tipo de contacto por defecto al crear.
const TipoContactoDefaultSync = () => {
  const record = useRecordContext<CRMContacto>();
  const { setValue } = useFormContext<CRMContactoFormValues>();
  const tipoId = useWatch({ name: "tipo_id" });
  const { data: tipos = [] } = useGetList<any>("crm/catalogos/tipos-contacto", {
    pagination: { page: 1, perPage: 100 },
    filter: { activo: true },
  });

  useEffect(() => {
    if (record?.id || tipoId || tipos.length === 0) return;
    const inmobiliaria = tipos.find((t: any) => t.nombre === "Inmobiliaria");
    if (inmobiliaria) setValue("tipo_id", inmobiliaria.id, { shouldDirty: false });
  }, [record?.id, tipoId, tipos, setValue]);

  return null;
};

const CamposPrincipalesContacto = () => (
  <div className="grid gap-2 md:grid-cols-2">
    <FormText
      source="nombre_completo"
      label="Nombre completo"
      validate={required()}
      widthClass="w-full md:col-span-2"
      maxLength={CRM_CONTACTO_VALIDATIONS.NOMBRE_MAX}
      placeholder="Nombre y apellido"
    />
    <FormText
      source="telefonos.0"
      label="Telefono principal"
      widthClass="w-full"
      placeholder="+54..."
    />
    <FormText
      source="email"
      label="Email"
      type="email"
      widthClass="w-full"
      maxLength={CRM_CONTACTO_VALIDATIONS.EMAIL_MAX}
      placeholder="contacto@dominio.com"
    />
    <FormText
      source="red_social"
      label="Usuario / red social"
      widthClass="w-full"
      maxLength={CRM_CONTACTO_VALIDATIONS.RED_SOCIAL_MAX}
      placeholder="@usuario"
    />
    <ReferenceInput source="tipo_id" reference="crm/catalogos/tipos-contacto" label="Tipo de contacto">
      <FormSelect
        optionText="nombre"
        emptyText="Seleccionar tipo"
        widthClass="w-full"
        validate={required()}
      />
    </ReferenceInput>
    <ReferenceInput source="responsable_id" reference="users" label="Responsable">
      <FormSelect
        optionText="nombre"
        emptyText="Seleccionar responsable"
        widthClass="w-full"
        validate={required()}
      />
    </ReferenceInput>
    <FormTextarea
      source="notas"
      label="Notas"
      widthClass="w-full md:col-span-2"
      className="[&_textarea]:min-h-[88px]"
      maxLength={CRM_CONTACTO_VALIDATIONS.NOTAS_MAX}
      placeholder="Observaciones relevantes del contacto"
    />
  </div>
);

const AyudaContactoCRM = () => (
  <div className="rounded-md border border-muted/60 bg-muted/30 p-3 text-xs text-muted-foreground">
    Registra los datos principales del contacto y asigna un responsable para
    facilitar el seguimiento comercial dentro de CRM.
  </div>
);

export const CRMContactoForm = ({
  onCancel,
}: {
  onCancel?: () => void;
}) => (
  <SimpleForm<CRMContactoFormValues>
    className="w-full max-w-2xl"
    toolbar={
      <FormOrderToolbar
        cancelProps={onCancel ? { onClick: onCancel } : undefined}
        saveProps={{ variant: "secondary" }}
      />
    }
    defaultValues={CRM_CONTACTO_DEFAULTS}
  >
    <ResponsableDefaultSync />
    <TipoContactoDefaultSync />
    <FormErrorSummary />
    <SectionBaseTemplate
      title="Datos del contacto"
      main={<CamposPrincipalesContacto />}
      optional={<AyudaContactoCRM />}
      defaultOpen
    />
  </SimpleForm>
);
