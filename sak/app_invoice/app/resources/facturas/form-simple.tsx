"use client";

import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";

export function FacturaFieldsSimple({ mode }: { mode: Mode }) {
  const ro = () => mode === "edit" && false;
  return (
    <div className="space-y-6">
      {/* Información Básica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Información de la Factura
          </CardTitle>
          <CardDescription>
            Datos básicos de la factura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextInput 
            source="numero" 
            label="Número" 
            required
            placeholder="Ej: 0001-00000123"
            helperText="Número de factura"
            disabled={ro()}
          />
          
          <TextInput 
            source="fecha_emision" 
            label="Fecha Emisión" 
            type="date"
            required
            helperText="Fecha de emisión del comprobante"
            disabled={ro()}
          />

          <NumberInput 
            source="total" 
            label="Total"
            required
            step={0.01}
            placeholder="0.00"
            helperText="Total general"
            disabled={ro()}
          />

          <ReferenceInput
            source="proveedor_id"
            reference="proveedores"
            label="Proveedor"
            helperText="Selecciona el proveedor de la factura"
            isRequired
          >
            <AutocompleteInput optionText="razon_social" />
          </ReferenceInput>

          <ReferenceInput 
            source="usuario_responsable_id" 
            reference="users" 
            label="Usuario Responsable"
            helperText="Usuario responsable del gasto"
            isRequired
          >
            <AutocompleteInput optionText="nombre" />
          </ReferenceInput>

          <SelectInput 
            source="estado" 
            label="Estado"
            isRequired
            choices={[
              { id: "PENDIENTE", name: "Pendiente" },
              { id: "PROCESADA", name: "Procesada" },
              { id: "APROBADA", name: "Aprobada" },
              { id: "RECHAZADA", name: "Rechazada" },
              { id: "PAGADA", name: "Pagada" },
              { id: "ANULADA", name: "Anulada" }
            ]}
            defaultValue="PENDIENTE"
            helperText="Estado actual de la factura"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { FacturaFieldsSimple as FacturaForm };
