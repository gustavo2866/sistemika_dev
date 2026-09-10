"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { required, useDataProvider, useGetOne, useNotify } from "ra-core";
import { useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { FormOrderToolbar } from "@/components/forms";
import {
  FormDate,
  FormErrorSummary,
  FormReferenceAutocomplete,
  FormValue,
  SectionBaseTemplate,
} from "@/components/forms/form_order";
import { SimpleForm } from "@/components/forms/form_order/simple_form";
import { ResourceBackButton } from "@/components/resource-back-button";

type TarjaNominaTrasladoRecord = {
  id: number;
  tarja_id: number;
  nomina_id?: number | null;
  empleado?: string | null;
  obra?: string | null;
  encargado?: string | null;
  proyecto_id?: number | null;
  tarja_fecha_desde?: string | null;
  tarja_fecha_hasta?: string | null;
};

type ProyectoEncargadoChoice = {
  id: number | string;
  contacto_id?: number | null;
  contacto?: {
    nombre_completo?: string | null;
    nombre?: string | null;
  } | null;
};

const requiredId = z.preprocess(
  (value) => (value == null || value === "" ? undefined : value),
  z.coerce.number().int().positive(),
);

const buildTrasladoSchema = (record?: TarjaNominaTrasladoRecord) =>
  z
    .object({
      proyecto_id: requiredId,
      proyecto_encargado_id: requiredId,
      fecha: z.string().min(1, "La fecha es obligatoria"),
    })
    .superRefine((values, context) => {
      if (record?.proyecto_id && values.proyecto_id === record.proyecto_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["proyecto_id"],
          message: "La obra destino debe ser diferente de la obra actual",
        });
      }
      if (
        record?.tarja_fecha_desde &&
        values.fecha < record.tarja_fecha_desde
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha"],
          message: "La fecha debe estar dentro de la quincena",
        });
      }
      if (
        record?.tarja_fecha_hasta &&
        values.fecha > record.tarja_fecha_hasta
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha"],
          message: "La fecha debe estar dentro de la quincena",
        });
      }
    });

type TrasladoFormValues = z.infer<ReturnType<typeof buildTrasladoSchema>>;

const getEncargadoLabel = (choice?: unknown) => {
  if (!choice || typeof choice !== "object") return "";
  const record = choice as ProyectoEncargadoChoice;
  return (
    record.contacto?.nombre_completo ||
    record.contacto?.nombre ||
    (record.contacto_id ? `Encargado #${record.contacto_id}` : "")
  );
};

const DestinoFields = () => {
  const { setValue } = useFormContext<TrasladoFormValues>();
  const proyectoId = Number(useWatch({ name: "proyecto_id" }));
  const previousProyectoId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!Number.isFinite(proyectoId) || proyectoId <= 0) return;
    if (
      previousProyectoId.current !== undefined &&
      previousProyectoId.current !== proyectoId
    ) {
      setValue("proyecto_encargado_id", undefined as unknown as number, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    previousProyectoId.current = proyectoId;
  }, [proyectoId, setValue]);

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <FormReferenceAutocomplete
        referenceProps={{ source: "proyecto_id", reference: "proyectos" }}
        inputProps={{
          optionText: "nombre",
          label: "Obra destino",
          placeholder: "Seleccionar",
          validate: required(),
        }}
        widthClass="w-full"
      />
      <FormReferenceAutocomplete
        referenceProps={{
          source: "proyecto_encargado_id",
          reference: "proyecto-encargados",
          filter: proyectoId
            ? { proyecto_id: proyectoId, activo: true }
            : { proyecto_id: -1, activo: true },
        }}
        inputProps={{
          optionText: getEncargadoLabel,
          inputText: getEncargadoLabel,
          label: "Encargado destino",
          placeholder: "Seleccionar",
          validate: required(),
          disabled: !proyectoId,
        }}
        widthClass="w-full"
      />
      <FormDate
        source="fecha"
        label="Fecha de traslado"
        validate={required()}
        widthClass="w-full"
      />
    </div>
  );
};

export const TarjaNominaTraslado = () => {
  const { id } = useParams();
  const sourceId = Number(id);
  const location = useLocation();
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || "/tarja-nomina";
  const { data: record, isPending } = useGetOne<TarjaNominaTrasladoRecord>(
    "tarja-nomina",
    { id: sourceId },
    { enabled: Number.isFinite(sourceId) && sourceId > 0 },
  );
  const schema = useMemo(() => buildTrasladoSchema(record), [record]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      await dataProvider.create(`tarja-nomina/${sourceId}/trasladar`, {
        data: values,
      });
      notify("Traslado realizado", { type: "success" });
      navigate(returnTo, { replace: true });
    } catch {
      // El data provider muestra el detalle devuelto por la API.
    }
  };

  if (isPending || !record) {
    return <div className="p-4 text-sm text-muted-foreground">Cargando traslado...</div>;
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
        <ResourceBackButton
          returnTo={returnTo}
          fallbackTo="/tarja-nomina"
          historyFallback={false}
        />
        <h2 className="text-xl font-bold sm:text-2xl">Trasladar empleado</h2>
      </div>
      <SimpleForm<TrasladoFormValues>
        className="w-full max-w-none"
        resolver={zodResolver(schema) as any}
        defaultValues={{
          proyecto_id: undefined as unknown as number,
          proyecto_encargado_id: undefined as unknown as number,
          fecha: "",
        }}
        onSubmit={handleSubmit}
        toolbar={
          <FormOrderToolbar
            cancelProps={{ onClick: () => navigate(returnTo) }}
          />
        }
      >
        <FormErrorSummary />
        <SectionBaseTemplate
          title="Origen"
          main={
            <div className="grid gap-2 md:grid-cols-2">
              <FormValue label="Empleado" widthClass="w-full">
                {record.empleado || `Empleado #${record.nomina_id}`}
              </FormValue>
              <FormValue label="Tarja actual" widthClass="w-full">
                {`#${record.tarja_id} - ${record.obra || "Sin obra"} - ${record.encargado || "Sin encargado"}`}
              </FormValue>
            </div>
          }
          defaultOpen
        />
        <SectionBaseTemplate
          title="Destino"
          main={<DestinoFields />}
          defaultOpen
        />
      </SimpleForm>
    </div>
  );
};
