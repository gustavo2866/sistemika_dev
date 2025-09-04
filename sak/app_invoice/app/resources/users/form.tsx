"use client";

import { TextInput } from "@/components/text-input";
import { ImageUploadInput } from "@/components/inputs/image-upload";
import { uploadUserPhoto } from "@/lib/upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";

type Mode = "create" | "edit";
type UserValues = {
  nombre: string;
  email: string;
  telefono?: string;
  url_foto?: string;
  pais_id?: number;
};

// Campos que querés bloquear en Edit
const READ_ONLY_ON_EDIT = new Set<keyof UserValues>([
  // "email",
]);

export function UserFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof UserValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información Personal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Información Personal
          </CardTitle>
          <CardDescription>
            Datos básicos del usuario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="nombre" 
              label="Nombre Completo" 
              required 
              disabled={ro("nombre")}
              placeholder="Ej: Juan Pérez"
              helperText="Nombre y apellido del usuario"
            />
            <TextInput 
              source="email" 
              label="Correo Electrónico" 
              required 
              disabled={ro("email")}
              placeholder="usuario@ejemplo.com"
              type="email"
              helperText="Dirección de correo válida"
            />
          </div>
          <TextInput 
            source="telefono" 
            label="Teléfono" 
            disabled={ro("telefono")}
            placeholder="+54 9 11 1234-5678"
            helperText="Número de contacto (opcional)"
          />
          <ReferenceInput
            source="pais_id"
            reference="paises"
            label="País"
            helperText="Selecciona el país del usuario"
          >
            <AutocompleteInput optionText="name" />
          </ReferenceInput>
        </CardContent>
      </Card>

      {/* Foto de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Foto de Perfil
          </CardTitle>
          <CardDescription>
            Imagen que se mostrará en el perfil del usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUploadInput source="url_foto" label="" uploadFn={uploadUserPhoto} />
        </CardContent>
      </Card>
    </div>
  );
}
