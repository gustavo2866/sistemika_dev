"use client";

import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { NumberInput } from "@/components/number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "create" | "edit";
type TipoOperacionValues = {
  codigo: string;
  descripcion: string;
  requiere_iva: boolean;
  porcentaje_iva_default?: number;
  cuenta_contable?: string;
  activo: boolean;
};

// Campos que querés bloquear en Edit
const READ_ONLY_ON_EDIT = new Set<keyof TipoOperacionValues>([
  "codigo", // Código no se puede cambiar una vez creado
]);

export function TipoOperacionFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof TipoOperacionValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Información General
          </CardTitle>
          <CardDescription>
            Datos básicos del tipo de operación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="codigo" 
              label="Código"
              placeholder="Ej: SERV, COMP, etc."
              readOnly={ro("codigo")}
              required
            />
            <div className="flex items-center">
              <BooleanInput 
                source="activo" 
                label="Tipo Activo"
                readOnly={ro("activo")}
              />
            </div>
          </div>
          
          <TextInput 
            source="descripcion" 
            label="Descripción"
            placeholder="Descripción del tipo de operación"
            readOnly={ro("descripcion")}
            required
          />
        </CardContent>
      </Card>

      {/* Configuración Fiscal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Configuración Fiscal
          </CardTitle>
          <CardDescription>
            Configuración de impuestos para este tipo de operación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center">
              <BooleanInput 
                source="requiere_iva" 
                label="Requiere IVA"
                readOnly={ro("requiere_iva")}
              />
            </div>
            
            <NumberInput 
              source="porcentaje_iva_default" 
              label="% IVA por Defecto"
              placeholder="21.0"
              readOnly={ro("porcentaje_iva_default")}
            />
          </div>
          
          <TextInput 
            source="cuenta_contable" 
            label="Cuenta Contable"
            placeholder="Ej: 1.1.01.001"
            readOnly={ro("cuenta_contable")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
