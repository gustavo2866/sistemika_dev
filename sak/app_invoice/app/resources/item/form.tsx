"use client";

import { TextInput } from "@/components/text-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";
type ItemValues = {
  name: string;
  description?: string;
  user_id?: number;
};

// Campos que querés bloquear en Edit
const READ_ONLY_ON_EDIT = new Set<keyof ItemValues>([
  // "name",
]);

export function ItemFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof ItemValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Información General
          </CardTitle>
          <CardDescription>
            Datos básicos del item
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput
              source="name"
              label="Nombre"
              required
              disabled={ro("name")}
              placeholder="Ej: Producto A"
              helperText="Nombre del item"
            />
            <TextInput
              source="description"
              label="Descripción"
              disabled={ro("description")}
              placeholder="Descripción detallada del item"
              helperText="Descripción opcional del item"
            />
          </div>
        </CardContent>
      </Card>

      {/* Asignación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Asignación
          </CardTitle>
          <CardDescription>
            Usuario asignado al item
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReferenceInput
            source="user_id"
            reference="users"
            label="Usuario"
            helperText="Selecciona el usuario propietario del item"
          >
            <SelectInput emptyText="Seleccionar usuario" optionText="nombre" />
          </ReferenceInput>
        </CardContent>
      </Card>
    </div>
  );
}
