"use client";

import { required, useRecordContext, useGetIdentity } from "ra-core";
import { useState, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { SimpleForm } from "@/components/simple-form";
import { TextInput } from "@/components/text-input";
import { SelectInput } from "@/components/select-input";
import { ReferenceInput } from "@/components/reference-input";
import { ArrayInput } from "@/components/array-input";
import { SimpleFormIterator } from "@/components/simple-form-iterator";
import { NumberInput } from "@/components/number-input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RaRecord } from "ra-core";

export const solicitudTipoChoices = [
  { id: "normal", name: "Normal" },
  { id: "directa", name: "Compra Directa" },
];

export type SolicitudDetalleFormValue = {
  id?: number;
  articulo_id?: number | null;
  descripcion?: string;
  unidad_medida?: string | null;
  cantidad?: number | string | null;
};

export type SolicitudFormValues = {
  id?: number;
  tipo?: "normal" | "directa";
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number | string;
  detalles?: SolicitudDetalleFormValue[];
};

type SolicitudRecord = RaRecord & {
  tipo?: string;
  fecha_necesidad?: string;
  comentario?: string | null;
  solicitante_id?: number;
  detalles?: SolicitudDetalleFormValue[];
};

export const SolicitudForm = () => {
  return (
    <SimpleForm
      className="w-full max-w-5xl space-y-6"
      defaultValues={(record?: SolicitudRecord) => ({
        tipo: record?.tipo ?? "normal",
        fecha_necesidad: record?.fecha_necesidad ?? "",
        comentario: record?.comentario ?? "",
        solicitante_id: record?.solicitante_id ?? undefined,
        detalles: mapDetalleRecords(record?.detalles ?? []),
      })}
    >
      <SolicitudFormFields />
    </SimpleForm>
  );
};

const SolicitudFormFields = () => {
  const record = useRecordContext<SolicitudRecord>();
  const { data: identity } = useGetIdentity();
  const isEditMode = !!(record && record.id);
  const isCreateMode = !isEditMode;
  const [isCollapsed, setIsCollapsed] = useState(isEditMode); // Colapsado en modo edición
  const form = useFormContext();
  
  // Establecer defaults cuando estamos en modo crear y tenemos la identidad
  useEffect(() => {
    if (isCreateMode && identity?.id) {
      const currentValues = form.getValues();
      const getCurrentDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
      };
      
      // Solo establecer valores si no están ya establecidos
      if (!currentValues.fecha_necesidad) {
        form.setValue("fecha_necesidad", getCurrentDate());
      }
      if (!currentValues.solicitante_id) {
        form.setValue("solicitante_id", identity.id);
      }
      if (!currentValues.tipo) {
        form.setValue("tipo", "normal");
      }
    }
  }, [isCreateMode, identity, form]);
  
  // Log para debugging (temporal)
  console.log("SolicitudFormFields - record:", record);
  console.log("SolicitudFormFields - isEditMode:", isEditMode);
  console.log("SolicitudFormFields - isCreateMode:", isCreateMode);
  console.log("SolicitudFormFields - identity:", identity);
  
  // Watch form values para el resumen
  const tipo = useWatch({ name: "tipo" });
  const comentario = useWatch({ name: "comentario" });
  const fechaNecesidad = useWatch({ name: "fecha_necesidad" });
  
  // Generar resumen dinámico
  const generateSummary = () => {
    const tipoText = tipo === "directa" ? "Compra Directa" : "Normal";
    const comentarioTruncated = comentario ? 
      (comentario.length > 50 ? comentario.substring(0, 50) + "..." : comentario) : 
      "Sin comentario";
    const fechaText = fechaNecesidad || "Sin fecha";
    
    return `${tipoText} • ${comentarioTruncated} • ${fechaText}`;
  };
  
  // Función para aceptar y colapsar
  const handleAccept = () => {
    // Agregar un detalle vacío si no existe
    const currentDetalles = form.getValues("detalles") || [];
    if (currentDetalles.length === 0) {
      form.setValue("detalles", [{
        id: undefined,
        articulo_id: undefined,
        descripcion: "",
        unidad_medida: "",
        cantidad: 0,
      }]);
    }
    setIsCollapsed(true);
  };
  
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Información General</h3>
              {isCollapsed && (
                <p className="text-sm text-muted-foreground mt-1">
                  {generateSummary()}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ml-2"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                source="tipo"
                label="Tipo"
                choices={solicitudTipoChoices}
                className="w-full"
              />
              <TextInput
                source="fecha_necesidad"
                label="Fecha de Necesidad"
                type="date"
                validate={required()}
                className="w-full"
              />
            </div>
            <ReferenceInput
              source="solicitante_id"
              reference="users"
              label="Solicitante"
            >
              <SelectInput optionText="nombre" className="w-full" validate={required()} />
            </ReferenceInput>
            <TextInput
              source="comentario"
              label="Comentario"
              multiline
              rows={3}
              className="w-full"
            />
            
            {/* Botón Aceptar solo en modo crear */}
            {isCreateMode && (
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleAccept}
                  className="px-6"
                >
                  Aceptar
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Detalle */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Detalle de Artículos</h3>
            <p className="text-sm text-muted-foreground">
              Agrega los artículos solicitados con sus cantidades y precios
            </p>
          </div>
          <Separator />
          <ArrayInput
            source="detalles"
            label={false}
          >
            <SimpleFormIterator inline={false} className="space-y-3">
              <DetalleIteratorItem />
            </SimpleFormIterator>
          </ArrayInput>
        </div>
      </Card>
    </div>
  );
};

const DetalleIteratorItem = () => (
  <div className="rounded-lg border p-4 space-y-4">
    <TextInput source="id" label={false} type="hidden" className="hidden" />
    <div className="grid gap-3 md:grid-cols-2">
      <ReferenceInput 
        source="articulo_id" 
        reference="articulos" 
        label="Artículo"
      >
        <SelectInput optionText="nombre" emptyText="Seleccionar" className="w-full" />
      </ReferenceInput>
      <TextInput
        source="descripcion"
        label="Descripción"
        validate={required()}
        placeholder="Describe la necesidad"
        className="w-full"
      />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <TextInput
        source="unidad_medida"
        label="Unidad de Medida"
        className="w-full"
      />
      <NumberInput
        source="cantidad"
        label="Cantidad"
        min={0.001}
        step={0.001}
        validate={required()}
        className="w-full"
      />
    </div>
  </div>
);

const mapDetalleRecords = (detalles: SolicitudDetalleFormValue[] = []) =>
  detalles.map((detalle) => ({
    id: detalle.id,
    articulo_id: detalle.articulo_id ?? undefined,
    descripcion: detalle.descripcion ?? "",
    unidad_medida: detalle.unidad_medida ?? "",
    cantidad: detalle.cantidad ?? 0,
  }));
