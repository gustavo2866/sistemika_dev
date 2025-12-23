"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreateBase,
  useGetList,
  useGetOne,
  useInput,
} from "ra-core";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { ComboboxQuery, ResponsableSelector } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SimpleForm } from "@/components/simple-form";
import { SaveButton } from "@/components/form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { Input } from "@/components/ui/input";

type ContactoActivoOption = {
  id: number;
  nombre_completo: string;
  oportunidad_id: number;
  oportunidad_titulo?: string | null;
};

type FormCrearEventoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFechaEvento?: string;
  identityId?: number | null;
  onCreated?: () => void;
  onError?: (error: any) => void;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const splitDateTime = (fecha?: string | null) => {
  if (!fecha) return { date: "", time: "" };
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return { date: formatDateInput(date), time: formatTimeInput(date) };
};

const DateTimeSplitInput = ({
  source,
  labelDate,
  labelTime,
  defaultValue,
}: {
  source: string;
  labelDate: string;
  labelTime: string;
  defaultValue?: string;
}) => {
  const { field } = useInput({ source, defaultValue });
  const initial = splitDateTime(field.value as string);
  const [dateValue, setDateValue] = useState(initial.date);
  const [timeValue, setTimeValue] = useState(initial.time);

  useEffect(() => {
    const next = splitDateTime(field.value as string);
    if (next.date !== dateValue) setDateValue(next.date);
    if (next.time !== timeValue) setTimeValue(next.time);
  }, [field.value, dateValue, timeValue]);

  const syncValue = (nextDate: string, nextTime: string) => {
    if (!nextDate || !nextTime) {
      field.onChange("");
      return;
    }
    field.onChange(`${nextDate}T${nextTime}`);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{labelDate}</Label>
        <Input
          type="date"
          value={dateValue}
          onChange={(event) => {
            const next = event.target.value;
            setDateValue(next);
            syncValue(next, timeValue);
          }}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{labelTime}</Label>
        <Input
          type="time"
          value={timeValue}
          onChange={(event) => {
            const next = event.target.value;
            setTimeValue(next);
            syncValue(dateValue, next);
          }}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-200 sm:px-3 sm:py-2 sm:text-sm"
        />
      </div>
    </div>
  );
};

const CrearEventoFormContent = () => {
  const form = useFormContext();
  const { field: asignadoField } = useController({ name: "asignado_a_id" });
  const oportunidadId = useWatch({ control: form.control, name: "oportunidad_id" });
  const contactoId = useWatch({ control: form.control, name: "contacto_id" });
  const tipoId = useWatch({ control: form.control, name: "tipo_id" });
  const { data: oportunidad } = useGetOne(
    "crm/oportunidades",
    { id: Number(oportunidadId) || 0 },
    { enabled: Boolean(oportunidadId) }
  );
  const { data: tiposEventoCatalogo = [] } = useGetList("crm/catalogos/tipos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: tipoEventoCatalogo } = useGetOne(
    "crm/catalogos/tipos-evento",
    { id: Number(tipoId) || 0 },
    { enabled: Boolean(tipoId) }
  );
  const { data: motivosEventoCatalogo = [] } = useGetList("crm/catalogos/motivos-evento", {
    pagination: { page: 1, perPage: 200 },
    filter: { activo: true },
    sort: { field: "nombre", order: "ASC" },
  });
  const { data: contactosActivos = [] } = useGetList<ContactoActivoOption>(
    "crm/gestion/contactos-activos",
    {
      pagination: { page: 1, perPage: 200 },
      filter: {},
      sort: { field: "nombre_completo", order: "ASC" },
    }
  );

  useEffect(() => {
    if (oportunidad?.contacto_id) {
      form.setValue("contacto_id", oportunidad.contacto_id, { shouldDirty: true });
    } else if (!oportunidadId) {
      form.setValue("contacto_id", null, { shouldDirty: true });
    }
  }, [oportunidad, oportunidadId, form]);

  useEffect(() => {
    if (!tipoId && tiposEventoCatalogo.length > 0) {
      const defaultTipo =
        tiposEventoCatalogo.find((tipo: any) => tipo.codigo === "llamada") ??
        tiposEventoCatalogo[0];
      if (defaultTipo) {
        form.setValue("tipo_id", defaultTipo.id, { shouldDirty: true });
      }
    }
  }, [tipoId, tiposEventoCatalogo, form]);

  useEffect(() => {
    if (tipoEventoCatalogo?.codigo) {
      form.setValue("tipo_evento", tipoEventoCatalogo.codigo, { shouldDirty: true });
    } else if (!tipoId) {
      form.setValue("tipo_evento", "", { shouldDirty: true });
    }
  }, [tipoEventoCatalogo, tipoId, form]);

  useEffect(() => {
    if (!form.getValues("motivo_id") && motivosEventoCatalogo.length > 0) {
      form.setValue("motivo_id", motivosEventoCatalogo[0].id, { shouldDirty: true });
    }
  }, [motivosEventoCatalogo, form]);

  const selectedContacto = useMemo(
    () =>
      contactosActivos.find(
        (contacto) => String(contacto.id) === String(contactoId ?? "")
      ),
    [contactosActivos, contactoId]
  );

  useEffect(() => {
    if (selectedContacto?.oportunidad_id) {
      form.setValue("oportunidad_id", selectedContacto.oportunidad_id, { shouldDirty: true });
    } else {
      form.setValue("oportunidad_id", null, { shouldDirty: true });
    }
  }, [selectedContacto, form]);

  const contactoOportunidadLabel = selectedContacto
    ? `#${String(selectedContacto.oportunidad_id).padStart(6, "0")} ${selectedContacto.oportunidad_titulo ?? ""}`.trim()
    : "";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ReferenceInput
          source="tipo_id"
          reference="crm/catalogos/tipos-evento"
          label="Tipo de evento"
          perPage={200}
          filter={{ activo: true }}
        >
          <SelectInput
            optionText="nombre"
            className="w-full"
            triggerProps={{
              className: "h-8 text-[11px] sm:h-9 sm:text-sm",
            }}
          />
        </ReferenceInput>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Contacto</Label>
          <ComboboxQuery
            source="contacto_id"
            resource="crm/gestion/contactos-activos"
            labelField="nombre_completo"
            limit={200}
            placeholder="Selecciona un contacto"
            className="w-full"
          />
        </div>
      </div>
      {selectedContacto ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Oportunidad</Label>
          <Input
            readOnly
            value={contactoOportunidadLabel}
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 sm:px-3 sm:py-2 sm:text-sm"
          />
        </div>
      ) : null}
      <DateTimeSplitInput source="fecha_evento" labelDate="Fecha" labelTime="Hora" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Asignado a</Label>
          <ResponsableSelector
            includeTodos={false}
            value={asignadoField.value ? String(asignadoField.value) : ""}
            onValueChange={(value) =>
              asignadoField.onChange(value ? Number(value) : null)
            }
            triggerClassName="h-8 text-[11px] sm:h-9 sm:text-sm"
          />
        </div>
        <TextInput
          source="titulo"
          label="Titulo"
          className="w-full [&_input]:h-8 [&_input]:text-[11px] sm:[&_input]:h-9 sm:[&_input]:text-sm"
        />
      </div>
      <TextInput
        source="descripcion"
        label="Descripcion"
        multiline
        rows={3}
        className="w-full [&_textarea]:text-[11px] sm:[&_textarea]:text-sm"
      />
      <TextInput source="tipo_evento" label={false} className="hidden" />
      <TextInput source="motivo_id" label={false} className="hidden" />
      <TextInput source="oportunidad_id" label={false} className="hidden" />
      <TextInput source="estado_evento" label={false} className="hidden" defaultValue="1-pendiente" />
    </div>
  );
};

export const FormCrearEventoDialog = ({
  open,
  onOpenChange,
  defaultFechaEvento,
  identityId,
  onCreated,
  onError,
}: FormCrearEventoDialogProps) => {
  const resolvedDefaultFechaEvento = useMemo(() => {
    if (defaultFechaEvento) return defaultFechaEvento;
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return `${formatDateInput(now)}T${formatTimeInput(now)}`;
  }, [defaultFechaEvento]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(event) => event.stopPropagation()} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear evento</DialogTitle>
          <DialogDescription>Completa los datos para crear el evento.</DialogDescription>
        </DialogHeader>
        <CreateBase
          resource="crm/eventos"
          redirect={false}
          mutationOptions={{
            onSuccess: onCreated,
            onError,
          }}
        >
          <SimpleForm
            className="w-full max-w-none"
            defaultValues={{
              fecha_evento: resolvedDefaultFechaEvento,
              estado_evento: "1-pendiente",
              asignado_a_id: identityId ?? null,
            }}
            toolbar={
              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
                  type="button"
                >
                  Cancelar
                </Button>
                <SaveButton
                  label="Crear"
                  className="h-8 px-3 text-[11px] sm:h-9 sm:text-sm"
                />
              </DialogFooter>
            }
          >
            <CrearEventoFormContent />
          </SimpleForm>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};
