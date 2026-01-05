"use client";

import { required, useGetIdentity, useGetOne, useRecordContext } from "ra-core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";

import { SimpleForm, FormToolbar } from "@/components/simple-form";

import { ReferenceInput } from "@/components/reference-input";

import {
  CompactComboboxQuery,
  CompactFormCard,
  CompactFormField,
  CompactFormGrid,
  CompactFormSection,
  CompactNumberInput,
  CompactSelectInput,
  CompactTextInput,
  FormLayout,
} from "@/components/forms";
import type { CRMOportunidad, CRMOportunidadEstado } from "./model";
import {
  CRM_OPORTUNIDAD_ESTADO_BADGES,
  formatDateValue,
  formatEstadoOportunidad,
} from "./model";
import { Badge } from "@/components/ui/badge";
import { IconButtonWithTooltip } from "@/components/icon-button-with-tooltip";
import { Calendar, FileText, MessageCircle } from "lucide-react";

type CRMOportunidadFormProps = {
  toolbar?: ReactNode;
};

export const CRMOportunidadForm = ({ toolbar }: CRMOportunidadFormProps = {}) => {
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
    <CompactFormCard className="rounded-[30px] border border-border/40 bg-gradient-to-b from-background to-muted/10 shadow-lg">
      <DatosGeneralesSection />
      <FormLayout
        spacing="lg"
        sections={[
          {
            id: "cotizacion",
            title: "COTIZACION",
            defaultOpen: false,
            contentPadding: "lg",
            children: <CotizacionSection />,
          },
          {
            id: "estado",
            title: "SEGUIMIENTO",
            defaultOpen: false,
            contentPadding: "lg",
            children: (
              <EstadoSection />
            ),
          },
        ]}
      />
    </CompactFormCard>
  );
};

function DatosGeneralesSection() {
  const record = useRecordContext<CRMOportunidad>();
  const { formState, setValue, watch } = useFormContext<CRMOportunidad>();
  const location = useLocation();
  const navigate = useNavigate();
  const hasInitializedRef = useRef(false);
  const lastAutoTitleRef = useRef<string | null>(null);
  const tipoOperacionId = watch("tipo_operacion_id");
  const tipoPropiedadId = watch("tipo_propiedad_id");
  const emprendimientoId = watch("emprendimiento_id");
  const contactoId = watch("contacto_id") ?? record?.contacto_id ?? null;
  const tituloValue = watch("titulo") ?? "";
  const estadoValue = (watch("estado") ?? record?.estado) as CRMOportunidadEstado | undefined;
  const fechaEstadoValue = watch("fecha_estado") ?? record?.fecha_estado ?? null;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

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
    const isTituloDirty = Boolean(formState.dirtyFields?.titulo);
    const canAutoUpdate =
      !isTituloDirty &&
      (!tituloValue || tituloValue === lastAutoTitleRef.current);
    if (canAutoUpdate && computedTitle !== tituloValue) {
      setValue("titulo", computedTitle, { shouldDirty: false });
      lastAutoTitleRef.current = computedTitle;
    }
  }, [computedTitle, formState.dirtyFields, setValue, tituloValue]);

  const handleOpenEventos = () => {
    if (!record?.id) return;
    const filter = {
      oportunidad_id: record.id,
      ...(contactoId ? { contacto_id: contactoId } : {}),
    };
    const filterParam = encodeURIComponent(JSON.stringify(filter));
    navigate(`/crm/eventos?filter=${filterParam}`, {
      state: {
        fromOportunidad: true,
        oportunidad_id: record.id,
        contacto_id: contactoId ?? undefined,
        returnTo: returnTo ?? `/crm/oportunidades/${record.id}`,
        filter,
      },
    });
  };

  const handleOpenSolicitudes = () => {
    if (!record?.id) return;
    const filter = { oportunidad_id: record.id };
    const filterParam = encodeURIComponent(JSON.stringify(filter));
    navigate(`/solicitudes?filter=${filterParam}`, {
      state: {
        oportunidad_id: record.id,
        returnTo: returnTo ?? `/crm/oportunidades/${record.id}`,
        filter,
      },
    });
  };

  const handleOpenChat = () => {
    if (!record?.id) return;
    navigate(`/crm/chat/op-${record.id}/show`, {
      state: { returnTo: returnTo ?? `/crm/oportunidades/${record.id}` },
    });
  };

  return (
    <>
      <CompactFormSection>
      <div className="flex items-center justify-end gap-1.5 pb-1">
        <IconButtonWithTooltip
          label="Chat"
          onClick={handleOpenChat}
          disabled={!record?.id}
          className="h-7 w-7"
        >
          <MessageCircle className="h-4 w-4" />
        </IconButtonWithTooltip>
        <IconButtonWithTooltip
          label="Eventos"
          onClick={handleOpenEventos}
          disabled={!record?.id}
          className="h-7 w-7"
        >
          <Calendar className="h-4 w-4" />
        </IconButtonWithTooltip>
        <IconButtonWithTooltip
          label="Solicitudes"
          onClick={handleOpenSolicitudes}
          disabled={!record?.id}
          className="h-7 w-7"
        >
          <FileText className="h-4 w-4" />
        </IconButtonWithTooltip>
      </div>
      <CompactFormGrid columns="two">
        <CompactFormField
          label="Contacto"
          error={formState.errors.contacto_id}
          required
        >
          <CompactComboboxQuery
            source="contacto_id"
            resource="crm/contactos"
            labelField="nombre_completo"
            limit={200}
            placeholder="Selecciona un contacto"
            className="w-full"
            clearable
          />
        </CompactFormField>
        <ReferenceInput
          source="tipo_operacion_id"
          reference="crm/catalogos/tipos-operacion"
          label="Tipo de operaci?n"
        >
          <CompactSelectInput
            optionText={(record) =>
              record?.id
                ? `${record.id} - ${record.nombre ?? record.descripcion ?? record.codigo ?? ""}`
                : ""
            }
            className="w-full"
            validate={required()}
          />
        </ReferenceInput>
      </CompactFormGrid>
      <CompactFormGrid columns="two">
        <CompactTextInput
          source="titulo"
          label="Titulo"
          className="w-full"
          placeholder="Se completa automaticamente"
        />
        <div className="space-y-1">
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            Estado
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={CRM_OPORTUNIDAD_ESTADO_BADGES[estadoValue ?? "1-abierta"] ?? "bg-slate-100 text-slate-800"}
            >
              {formatEstadoOportunidad(estadoValue)}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {formatDateValue(typeof fechaEstadoValue === "string" ? fechaEstadoValue : null)}
            </span>
          </div>
        </div>
      </CompactFormGrid>
      </CompactFormSection>
      <FormLayout
        spacing="lg"
        sections={[
          {
            id: "propiedad",
            title: "PROPIEDAD",
            defaultOpen: false,
            contentPadding: "lg",
            children: (
              <CompactFormSection>
                <CompactFormGrid columns="two">
                  <ReferenceInput source="tipo_propiedad_id" reference="tipos-propiedad" label="Tipo de propiedad">
                    <CompactSelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
                  </ReferenceInput>
                  <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
                    <CompactSelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
                  </ReferenceInput>
                </CompactFormGrid>
                <CompactFormGrid>
                  <CompactTextInput
                    source="descripcion_estado"
                    label="Descripcion"
                    multiline
                    rows={2}
                    className="w-full"
                  />
                </CompactFormGrid>
              </CompactFormSection>
            ),
          },
        ]}
      />
    </>
  );
}

function CotizacionSection() {
  return (
    <CompactFormSection>
      <CompactFormGrid style={{ gridTemplateColumns: "1fr auto 1fr" }}>
        <div>
          <ReferenceInput source="propiedad_id" reference="propiedades" label="Propiedad">
            <CompactSelectInput optionText="nombre" className="w-full" />
          </ReferenceInput>
        </div>
        <div className="min-w-[80px]">
          <ReferenceInput source="moneda_id" reference="monedas" label=" ">
            <CompactSelectInput
              optionText={(record) =>
                record?.simbolo ? `${record.simbolo}` : record?.codigo || record?.nombre
              }
              emptyText="Seleccionar"
              className="w-full"
            />
          </ReferenceInput>
        </div>
        <div>
          <CompactNumberInput source="monto" label="Monto" className="w-full" step="any" />
        </div>
      </CompactFormGrid>
      <CompactFormGrid>
        <div>
          <ReferenceInput
            source="condicion_pago_id"
            reference="crm/catalogos/condiciones-pago"
            label="Condicion de pago"
          >
            <CompactSelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
          </ReferenceInput>
        </div>
        <div>
          <CompactTextInput 
            source="forma_pago_descripcion" 
            rows={2}
            label="Descripción forma de pago" 
            multiline 
            className="w-full" 
            placeholder="Detalles adicionales sobre la forma de pago"
          />
        </div>
      </CompactFormGrid>
    </CompactFormSection>
  );
}

function EstadoSection() {
  return (
    <CompactFormSection>
      <CompactFormGrid>
        <ReferenceInput source="responsable_id" reference="users" label="Responsable">
          <CompactSelectInput optionText="nombre" className="w-full" validate={required()} />
        </ReferenceInput>
      </CompactFormGrid>
      <CompactFormGrid columns="three">
        <ReferenceInput source="motivo_perdida_id" reference="crm/catalogos/motivos-perdida" label="Motivo pérdida">
          <CompactSelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
        </ReferenceInput>
        <CompactNumberInput source="probabilidad" label="Probabilidad (%)" min={0} max={100} className="w-full" />
        <CompactTextInput source="fecha_cierre_estimada" label="Cierre estimado" type="date" className="w-full" />
      </CompactFormGrid>
    </CompactFormSection>
  );
}

