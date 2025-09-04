"use client";

import { TextInput } from "@/components/text-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "create" | "edit";
type PaisValues = {
  name: string;
};

// Campos que querés bloquear en Edit
const READ_ONLY_ON_EDIT = new Set<keyof PaisValues>([
  // "email",
]);

export function PaisFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof PaisValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información Personal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Información Paises
          </CardTitle>
          <CardDescription>
            Datos básicos del Pais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="name" 
              label="Nombre Pais" 
              required 
              disabled={ro("name")}
              placeholder="Ej: Argentina"
              helperText="Nombre del pais"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
