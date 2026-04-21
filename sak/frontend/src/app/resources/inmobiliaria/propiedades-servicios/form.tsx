"use client";

import { useEffect, useMemo } from "react";
import { required, useRecordContext } from "ra-core";
import { useLocation, useNavigate } from "react-router-dom";
import { useFormContext, useWatch } from "react-hook-form";

import { SimpleForm } from "@/components/simple-form";
import {
  FormBoolean,
  FormDate,
  FormErrorSummary,
  FormOrderToolbar,
  FormText,
  FormTextarea,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { resolveNumericId } from "@/components/forms/form_order";
import { ReferenceInput } from "@/components/reference-input";
import { FormSelect } from "@/components/forms/form_order";

type PropiedadServicioFormValues = {
  propiedad_id?: number | null;
  servicio_tipo_id?: number | null;
  ref_cliente?: string | null;
  fecha?: string | null;
  activo?: boolean | null;
  comentario?: string | null;
};

const useDefaultPropiedadId = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveNumericId(params.get("propiedad_id"));
  }, [location.search]);
};

const useLockPropiedad = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("lock_propiedad") === "1";
  }, [location.search]);
};

const useReturnTo = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnTo");
  }, [location.search]);
};

const useReturnMode = () => {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("returnMode");
  }, [location.search]);
};

const PropiedadDefaultSync = () => {
  const defaultPropiedadId = useDefaultPropiedadId();
  const { setValue } = useFormContext<PropiedadServicioFormValues>();
  const propiedadIdValue = useWatch({ name: "propiedad_id" }) as unknown;

  useEffect(() => {
    if (!defaultPropiedadId) return;
    const currentPropiedadId = resolveNumericId(propiedadIdValue);
    if (currentPropiedadId) return;
    setValue("propiedad_id", defaultPropiedadId, { shouldDirty: false });
  }, [defaultPropiedadId, propiedadIdValue, setValue]);

  return null;
};

export const PropiedadServicioForm = () => (
  <PropiedadServicioFormContent />
);

const PropiedadServicioFormContent = () => {
  const record = useRecordContext<{ id?: number | string }>();
  const defaultPropiedadId = useDefaultPropiedadId();
  const lockPropiedad = useLockPropiedad();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const returnMode = useReturnMode();
  const defaultValues = useMemo(
    () =>
      record?.id
        ? undefined
        : {
            activo: true,
            ...(defaultPropiedadId ? { propiedad_id: defaultPropiedadId } : {}),
          },
    [defaultPropiedadId, record?.id],
  );
  const handleCancel = () => {
    if (returnMode === "history") {
      navigate(-1);
      return;
    }
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <SimpleForm<PropiedadServicioFormValues>
      className="w-full max-w-2xl"
      defaultValues={defaultValues}
      warnWhenUnsavedChanges
      toolbar={<FormOrderToolbar cancelProps={{ onClick: handleCancel }} />}
    >
      <PropiedadDefaultSync />
      <FormErrorSummary />
      <SectionBaseTemplate
        title="Datos del servicio"
        main={
          <div className="grid gap-2 md:grid-cols-2 md:items-end">
            <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
              <FormSelect
                optionText="nombre"
                label="Propiedad"
                widthClass="w-full"
                emptyText="Sin asignar"
                validate={required()}
                triggerProps={{ disabled: lockPropiedad }}
              />
            </ReferenceInput>
            <ReferenceInput
              source="servicio_tipo_id"
              reference="servicios-tipo"
              label="Tipo de servicio"
              filter={{ activo: true }}
            >
              <FormSelect
                optionText="nombre"
                label="Tipo de servicio"
                widthClass="w-full"
                emptyText="Sin asignar"
                validate={required()}
              />
            </ReferenceInput>
            <FormText source="ref_cliente" label="Ref. cliente" widthClass="w-full" />
            <FormDate source="fecha" label="Fecha" widthClass="w-full" />
            <FormBoolean source="activo" label="Activo" />
            <FormTextarea
              source="comentario"
              label="Comentario"
              widthClass="w-full"
              className="md:col-span-2 [&_textarea]:min-h-[72px]"
            />
          </div>
        }
        defaultOpen
      />
    </SimpleForm>
  );
};
