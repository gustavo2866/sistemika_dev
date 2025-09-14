"use client";

import { TextInput } from "@/components/text-input";
import { BooleanInput } from "@/components/boolean-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "create" | "edit";
type ProveedorValues = {
  nombre: string;
  razon_social: string;
  cuit: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  cbu?: string;
  alias_bancario?: string;
  activo: boolean;
};

// Campos que querés bloquear en Edit
const READ_ONLY_ON_EDIT = new Set<keyof ProveedorValues>([
  "cuit", // CUIT no se puede cambiar una vez creado
]);

export function ProveedorFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof ProveedorValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Información General
          </CardTitle>
          <CardDescription>
            Datos básicos del proveedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="nombre" 
              label="Nombre Comercial"
              placeholder="Ingrese el nombre comercial"
              readOnly={ro("nombre")}
              required
            />
            <TextInput 
              source="razon_social" 
              label="Razón Social"
              placeholder="Ingrese la razón social"
              readOnly={ro("razon_social")}
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="cuit" 
              label="CUIT"
              placeholder="XX-XXXXXXXX-X"
              readOnly={ro("cuit")}
              required
            />
            <div className="flex items-center">
              <BooleanInput 
                source="activo" 
                label="Proveedor Activo"
                readOnly={ro("activo")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información de Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Información de Contacto
          </CardTitle>
          <CardDescription>
            Datos de contacto del proveedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="telefono" 
              label="Teléfono"
              placeholder="Ingrese el teléfono"
              readOnly={ro("telefono")}
            />
            <TextInput 
              source="email" 
              label="Email"
              placeholder="email@ejemplo.com"
              readOnly={ro("email")}
              type="email"
            />
          </div>
          
          <TextInput 
            source="direccion" 
            label="Dirección"
            placeholder="Ingrese la dirección completa"
            readOnly={ro("direccion")}
          />
        </CardContent>
      </Card>

      {/* Información Bancaria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Información Bancaria
          </CardTitle>
          <CardDescription>
            Datos bancarios para pagos (opcional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="cbu" 
              label="CBU"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXX"
              readOnly={ro("cbu")}
            />
            <TextInput 
              source="alias_bancario" 
              label="Alias Bancario"
              placeholder="alias.bancario.ejemplo"
              readOnly={ro("alias_bancario")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
