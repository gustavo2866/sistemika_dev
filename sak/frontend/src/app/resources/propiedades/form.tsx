"use client";

import { required, useDataProvider, useRecordContext } from "ra-core";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { FormLayout, FormSimpleSection } from "@/components/forms";
import { ESTADOS_PROPIEDAD_OPTIONS, formatEstadoPropiedad } from "./model";
import type { Propiedad, Vacancia, PropiedadEstado } from "./model";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

export const PropiedadForm = () => {
  // const dataProvider = useDataProvider();
  // const notify = useNotify();
  // const record = useRecordContext<Propiedad>();
  // const isCreate = !record?.id;

  // TODO: Revisar cómo manejar la creación automática de vacancia inicial
  // El callback onSuccess no es soportado por SimpleForm actual
  /*
  const handleSuccess = async ({ data }: { data: Propiedad }) => {
    if (!isCreate) return;
    try {
      if (!data?.id) return;
      await dataProvider.create("vacancias", {
        data: {
          propiedad_id: data.id,
          ciclo_activo: true,
          fecha_recibida: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la vacancia inicial";
      notify(message, { type: "warning" });
    }
  };
  */

  return (
    <SimpleForm
      className="w-full max-w-4xl"
      warnWhenUnsavedChanges
      defaultValues={{ estado: "1-recibida" }}
    >
      <PropiedadFormContent />
    </SimpleForm>
  );
};

const PropiedadFormContent = () => {
  const form = useFormContext();
  const record = useRecordContext<Propiedad>();
  const control = form.control;
  const isEditMode = Boolean(record?.id);

  const nombreWatch = useWatch({ control, name: "nombre" });
  const propietarioWatch = useWatch({ control, name: "propietario" });
  const estadoWatch = useWatch({ control, name: "estado" });
  const valorAlquilerWatch = useWatch({ control, name: "valor_alquiler" });
  const expensasWatch = useWatch({ control, name: "expensas" });
  const vencimientoWatch = useWatch({ control, name: "vencimiento_contrato" });
  const tipoOperacionWatch = useWatch({ control, name: "tipo_operacion_id" });
  const emprendimientoWatch = useWatch({ control, name: "emprendimiento_id" });
  const costoPropWatch = useWatch({ control, name: "costo_propiedad" });
  const costoMonedaWatch = useWatch({ control, name: "costo_moneda_id" });
  const precioVentaWatch = useWatch({ control, name: "precio_venta_estimado" });
  const precioMonedaWatch = useWatch({ control, name: "precio_moneda_id" });

  const estadoValue: PropiedadEstado | undefined =
    (estadoWatch as PropiedadEstado) || record?.estado;

  const generalSubtitleItems = [
    nombreWatch || record?.nombre,
    propietarioWatch || record?.propietario,
    estadoValue ? formatEstadoPropiedad(estadoValue) : null,
  ].filter(Boolean);
  const generalSubtitle =
    generalSubtitleItems.join(" - ") ||
    "Defini el nombre, propietario y estado.";

  const valorAlquilerText = formatCurrencyShort(
    valorAlquilerWatch ?? record?.valor_alquiler
  );
  const expensasText = formatCurrencyShort(expensasWatch ?? record?.expensas);
  const vencimientoText = formatDateValue(
    vencimientoWatch ?? record?.vencimiento_contrato
  );
  const contratoSubtitleItems = [
    valorAlquilerText ? `Alquiler ${valorAlquilerText}` : null,
    expensasText ? `Expensas ${expensasText}` : null,
    vencimientoText ? `Vence ${vencimientoText}` : null,
  ].filter(Boolean);
  const contratoSubtitle =
    contratoSubtitleItems.join(" - ") ||
    "Detalla montos, expensas y vigencia.";

  const tipoOperacionLabel =
    record?.tipo_operacion?.nombre ||
    (tipoOperacionWatch ? `Tipo operacion #${tipoOperacionWatch}` : null);
  const emprendimientoLabel =
    record?.emprendimiento?.nombre ||
    (emprendimientoWatch ? `Emprendimiento #${emprendimientoWatch}` : null);
  const relacionesSubtitleItems = [tipoOperacionLabel, emprendimientoLabel].filter(
    Boolean
  );
  const relacionesSubtitle =
    relacionesSubtitleItems.join(" - ") ||
    "Relaciona la propiedad dentro de CRM.";

  const costoPropText = formatCurrencyShort(
    costoPropWatch ?? record?.costo_propiedad
  );
  const precioVentaText = formatCurrencyShort(
    precioVentaWatch ?? record?.precio_venta_estimado
  );
  const costoMonedaLabel =
    record?.costo_moneda?.nombre ||
    (costoMonedaWatch ? `Moneda #${costoMonedaWatch}` : null);
  const precioMonedaLabel =
    record?.precio_moneda?.nombre ||
    (precioMonedaWatch ? `Moneda #${precioMonedaWatch}` : null);
  const valorSubtitleItems = [
    costoPropText ? `Costo ${costoPropText}` : null,
    costoMonedaLabel,
    precioVentaText ? `Precio ${precioVentaText}` : null,
    precioMonedaLabel,
  ].filter(Boolean);
  const valorSubtitle =
    valorSubtitleItems.join(" - ") || "Define costos y monedas estimadas.";

  const vacanciasCount = record?.vacancias?.length ?? 0;
  const vacanciasSubtitle = vacanciasCount
    ? `${vacanciasCount} ciclo${vacanciasCount === 1 ? "" : "s"} registrados`
    : "Se mostraran luego de guardar.";

  return (
    <FormLayout
      sections={[
        {
          id: "datos-generales",
          title: "Datos generales",
          subtitle: generalSubtitle,
          defaultOpen: !isEditMode,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="nombre" label="Nombre" validate={required()} className="w-full" />
                <TextInput source="tipo" label="Tipo" validate={required()} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="propietario" label="Propietario" validate={required()} className="w-full" />
                <SelectInput
                  source="estado"
                  label="Estado actual"
                  choices={ESTADOS_PROPIEDAD_OPTIONS.map((option) => ({
                    id: option.value,
                    name: option.label,
                  }))}
                  className="w-full"
                  disabled
                  validate={required()}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput source="ambientes" label="Ambientes" min={0} className="w-full" />
                <NumberInput source="metros_cuadrados" label="Metros cuadrados" step={0.1} min={0} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput source="fecha_ingreso" label="Fecha de ingreso" type="date" className="w-full" />
              </div>
              <TextInput
                source="estado_comentario"
                label="Comentario"
                multiline
                rows={4}
                placeholder="Detalle el motivo del ultimo cambio de estado"
                className="w-full"
              />
            </FormSimpleSection>
          ),
        },
        {
          id: "datos-contrato",
          title: "Datos del contrato",
          subtitle: contratoSubtitle,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput source="valor_alquiler" label="Valor alquiler" step="any" min={0} className="w-full" />
                <NumberInput source="expensas" label="Expensas" step="any" min={0} className="w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  source="vencimiento_contrato"
                  label="Vencimiento contrato"
                  type="date"
                  className="w-full"
                />
                <ReferenceInput
                  source="contacto_id"
                  reference="crm/contactos"
                  label="Contacto propietario"
                >
                  <SelectInput optionText="nombre_completo" emptyText="Sin asignar" className="w-full" />
                </ReferenceInput>
              </div>
            </FormSimpleSection>
          ),
        },
        {
          id: "relaciones-crm",
          title: "Relaciones CRM",
          subtitle: relacionesSubtitle,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <ReferenceInput
                  source="tipo_operacion_id"
                  reference="crm/catalogos/tipos-operacion"
                  label="Tipo de operacion CRM"
                >
                  <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
                </ReferenceInput>
                <ReferenceInput source="emprendimiento_id" reference="emprendimientos" label="Emprendimiento">
                  <SelectInput optionText="nombre" emptyText="Sin asignar" className="w-full" />
                </ReferenceInput>
              </div>
            </FormSimpleSection>
          ),
        },
        {
          id: "valor-propiedad",
          title: "Valoracion y monedas",
          subtitle: valorSubtitle,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput
                  source="costo_propiedad"
                  label="Costo de la propiedad"
                  step="any"
                  min={0}
                  className="w-full"
                />
                <ReferenceInput source="costo_moneda_id" reference="monedas" label="Moneda del costo">
                  <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
                </ReferenceInput>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberInput
                  source="precio_venta_estimado"
                  label="Precio estimado de venta"
                  step="any"
                  min={0}
                  className="w-full"
                />
                <ReferenceInput source="precio_moneda_id" reference="monedas" label="Moneda del precio">
                  <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
                </ReferenceInput>
              </div>
            </FormSimpleSection>
          ),
        },
        {
          id: "vacancias",
          title: "Vacancia",
          subtitle: vacanciasSubtitle,
          collapsible: true,
          defaultOpen: false,
          children: (
            <FormSimpleSection>
              <PropiedadVacanciasTable />
            </FormSimpleSection>
          ),
        },
      ]}
    />
  );
};

const formatCurrencyShort = (value?: unknown) => {
  if (value == null || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const formatDateValue = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-AR");
};

const PropiedadVacanciasTable = () => {
  const record = useRecordContext<Propiedad>();
  const dataProvider = useDataProvider();
  const [vacancias, setVacancias] = useState<Vacancia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record?.id) {
      setVacancias([]);
      return;
    }

    let cancel = false;
    const fetchVacancias = async () => {
      setLoading(true);
      try {
        const response = await dataProvider.getList<Vacancia>("vacancias", {
          filter: { propiedad_id: record.id },
          pagination: { page: 1, perPage: 50 },
          sort: { field: "created_at", order: "DESC" },
        });
        if (!cancel) {
          setVacancias(response.data ?? []);
        }
      } catch {
        if (!cancel) {
          setVacancias([]);
        }
      } finally {
        if (!cancel) {
          setLoading(false);
        }
      }
    };

    fetchVacancias();

    return () => {
      cancel = true;
    };
  }, [dataProvider, record?.id]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-AR");
  };

  if (!record?.id) {
    return <p className="text-xs text-muted-foreground">Disponible despues de guardar la propiedad.</p>;
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Cargando vacancias...</p>;
  }

  if (!vacancias.length) {
    return <p className="text-xs text-muted-foreground">Sin registros de vacancia.</p>;
  }

  return (
    <div className="max-h-56 overflow-x-auto overflow-y-auto">
      <Table className="text-[11px] min-w-[680px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-2 py-1">#</TableHead>
            <TableHead className="px-2 py-1">Estado</TableHead>
            <TableHead className="px-2 py-1">Recibida</TableHead>
            <TableHead className="px-2 py-1">Disp.</TableHead>
            <TableHead className="px-2 py-1">Realizada</TableHead>
            <TableHead className="px-2 py-1">Retirada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vacancias.map((vacancia) => (
            <TableRow key={vacancia.id} className="hover:bg-transparent">
              <TableCell className="px-2 py-1 font-semibold">#{vacancia.id}</TableCell>
              <TableCell className="px-2 py-1">
                {vacancia.ciclo_activo ? "Activo" : "Cerrado"}
              </TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_recibida)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_disponible)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_alquilada)}</TableCell>
              <TableCell className="px-2 py-1">{formatDate(vacancia.fecha_retirada)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

