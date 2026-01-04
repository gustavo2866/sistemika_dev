"use client";

import { required, useGetIdentity, useGetOne, useRecordContext } from "ra-core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";

import { SimpleForm, FormToolbar } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";
import { NumberInput } from "@/components/number-input";
import { Card } from "@/components/ui/card";
import { ComboboxQuery, FormField, FormLayout, FormSimpleSection } from "@/components/forms";
import type { CRMOportunidad } from "./model";

const compactSelectTrigger = {
  className: "h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm",
};

type CRMOportunidadPanelFormProps = {
  toolbar?: ReactNode;
};

export const CRMOportunidadPanelForm = ({ toolbar }: CRMOportunidadPanelFormProps = {}) => {
  const record = useRecordContext<CRMOportunidad>();
  const { identity } = useGetIdentity();
  const defaultValues = record?.id
    ? undefined
    : { responsable_id: identity?.id ?? undefined };

  return (
    <div className="w-full max-w-4xl mr-auto ml-0">
      <SimpleForm
        className="w-full max-w-none"
        defaultValues={defaultValues}
        sectionHeaderDensity="compact"
        toolbar={
          toolbar ?? (
            <FormToolbar className="mt-3 rounded-2xl border border-border/50 bg-background/80 p-2 shadow-sm sm:mt-4 sm:p-3" />
          )
        }
      >
        <OportunidadFormSections />
      </SimpleForm>
    </div>
  );
};

const OportunidadFormSections = () => {
  const record = useRecordContext<CRMOportunidad>();

  return (
    <Card className="flex w-full flex-col gap-5 rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 p-4 shadow-lg sm:gap-6 sm:p-5 [&_label]:!text-[10px] [&_label]:uppercase [&_label]:tracking-[0.25em] [&_[data-slot=form-label]]:!text-[10px] [&_[data-slot=form-label]]:uppercase [&_[data-slot=form-label]]:tracking-[0.25em] [&_input]:!h-8 [&_input]:!px-2 [&_input]:!text-xs [&_[data-slot=input]]:!h-8 [&_[data-slot=input]]:!px-2 [&_[data-slot=input]]:!text-xs [&_textarea]:!min-h-12 [&_textarea]:!px-2 [&_textarea]:!py-2 [&_textarea]:!text-xs [&_[data-slot=textarea]]:!min-h-12 [&_[data-slot=textarea]]:!px-2 [&_[data-slot=textarea]]:!py-2 [&_[data-slot=textarea]]:!text-xs sm:[&_label]:!text-[11px] sm:[&_label]:tracking-[0.2em] sm:[&_input]:!h-9 sm:[&_input]:!px-3 sm:[&_input]:!text-sm sm:[&_textarea]:!min-h-16 sm:[&_textarea]:!px-3 sm:[&_textarea]:!py-2 sm:[&_textarea]:!text-sm sm:[&_[data-slot=textarea]]:!min-h-16 sm:[&_[data-slot=textarea]]:!px-3 sm:[&_[data-slot=textarea]]:!py-2 sm:[&_[data-slot=textarea]]:!text-sm">
      <DatosGeneralesSection />
      <FormLayout
        spacing="lg"
        sections={[
          {
            id: "cotizacion",
            title: "Cotización",
            defaultOpen: false,
            contentPadding: "lg",
            children: <CotizacionSection />,
          },
          {
            id: "estado",
            title: "Seguimiento",
            defaultOpen: false,
            contentPadding: "lg",
            children: (
              <EstadoSection />
            ),
          },
        ]}
      />
    </Card>
  );
};

function DatosGeneralesSection() {
  const record = useRecordContext<CRMOportunidad>();
  const { formState, setValue, watch } = useFormContext<CRMOportunidad>();
  const hasInitializedRef = useRef(false);
  const tipoOperacionId = watch("tipo_operacion_id");
  const tipoPropiedadId = watch("tipo_propiedad_id");
  const emprendimientoId = watch("emprendimiento_id");
  const tituloValue = watch("titulo") ?? "";

  const { data: tipoOperacion } = useGetOne(
    "crm/catalogos/tipos-operacion",
    { id: tipoOperacionId ?? 0 },
    { enabled: Boolean(tipoOperacionId) }
  );
  const { data: tipoPropiedad } = useGetOne(
    "tipos-propiedad",
    { id: tipoPropiedadId ?? 0 },
    { enabled: Boolean(tipoPropiedadId) }
  );
  const { data: emprendimiento } = useGetOne(
    "emprendimientos",
    { id: emprendimientoId ?? 0 },
    { enabled: Boolean(emprendimientoId) }
  );

  const titleParts: string[] = [];
  if (tipoOperacion?.nombre) {
    titleParts.push(tipoOperacion.nombre);
  }
  if (emprendimiento?.nombre) {
    titleParts.push(emprendimiento.nombre);
  } else if (tipoPropiedad?.nombre) {
    titleParts.push(tipoPropiedad.nombre);
  }
  const computedTitle = titleParts.join(" - ").trim();

  useEffect(() => {
    if (!record || hasInitializedRef.current) return;
    if (record.tipo_propiedad_id != null) {
      setValue("tipo_propiedad_id", record.tipo_propiedad_id, { shouldDirty: false });
    }
    if (record.emprendimiento_id != null) {
      setValue("emprendimiento_id", record.emprendimiento_id, { shouldDirty: false });
    }
    hasInitializedRef.current = true;
  }, [record, setValue]);

  useEffect(() => {
    if (!computedTitle) return;
    if (computedTitle !== tituloValue) {
      setValue("titulo", computedTitle, { shouldDirty: true });
    }
  }, [computedTitle, setValue, tituloValue]);

  return (
    <FormSimpleSection className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-5">
        <ReferenceInput
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          label="Tipo de operación"
        >
          <SelectInput
            optionText={(record) =>
              record?.id
                ? `${record.id} - ${record.nombre ?? record.descripcion ?? record.codigo ?? ""}`
                : ""
            }
            className="w-full"
            triggerProps={compactSelectTrigger}
            validate={required()}
          />
        </ReferenceInput>
        <FormField
          label="Contacto"
          error={formState.errors.contacto_id}
          required
        >
          <ComboboxQuery
            source="contacto_id"
            resource="crm/contactos"
            labelField="nombre_completo"
            limit={200}
            placeholder="Selecciona un contacto"
            className="w-full"
            clearable
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-5">
        <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo de propiedad">
          <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" triggerProps={compactSelectTrigger} />
        </ReferenceInput>
        <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
          <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" triggerProps={compactSelectTrigger} />
        </ReferenceInput>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <TextInput source="titulo" label="Título" className="w-full" placeholder="Se completa automáticamente" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <TextInput source="descripcion_estado" label="Descripción" multiline className="w-full" />
      </div>
    </FormSimpleSection>
  );
}

function CotizacionSection() {
  return (
    <FormSimpleSection className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <div>
          <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
            <SelectInput optionText="nombre" className="w-full" triggerProps={compactSelectTrigger} />
          </ReferenceInput>
        </div>
        <div className="min-w-[80px]">
          <ReferenceInput source="moneda_id" reference="monedas" label=" ">
            <SelectInput
              optionText={(record) =>
                record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre
              }
              emptyText="Seleccionar"
              className="w-full"
              triggerProps={compactSelectTrigger}
            />
          </ReferenceInput>
        </div>
        <div>
          <NumberInput source="monto" label="Monto" className="w-full" step="any" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <div>
          <ReferenceInput
            source="condicion_pago_id"
            reference="crm/catalogos/condiciones-pago"
            label="Condición de pago"
          >
            <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" triggerProps={compactSelectTrigger} />
          </ReferenceInput>
        </div>
        <div>
          <TextInput 
            source="forma_pago_descripcion" 
            label="Descripción forma de pago" 
            multiline 
            className="w-full" 
            placeholder="Detalles adicionales sobre la forma de pago"
          />
        </div>
      </div>
    </FormSimpleSection>
  );
}

function EstadoSection() {
  return (
    <FormSimpleSection className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        <ReferenceInput source="responsable_id" reference="users" label="Responsable">
          <SelectInput optionText="nombre" className="w-full" validate={required()} triggerProps={compactSelectTrigger} />
        </ReferenceInput>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-5">
        <ReferenceInput source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" label="Motivo pérdida">
          <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" triggerProps={compactSelectTrigger} />
        </ReferenceInput>
        <NumberInput source="probabilidad" label="Probabilidad (%)" min={0} max={100} className="w-full" />
        <TextInput source="fecha_cierre_estimada" label="Cierre estimado" type="date" className="w-full" />
      </div>
    </FormSimpleSection>
  );
}

