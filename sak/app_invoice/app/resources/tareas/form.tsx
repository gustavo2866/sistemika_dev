"use client";

import { TextInput } from "@/components/text-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";
type TareaValues = {
  titulo: string;
  descripcion?: string;
  estado: string;
  prioridad: string;
  fecha_vencimiento?: string;
  user_id: number;
};

const READ_ONLY_ON_EDIT = new Set<keyof TareaValues>([
  // Campos que querés bloquear en Edit si es necesario
]);

export function TareaFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof TareaValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información de la Tarea - Siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Información de la Tarea
          </CardTitle>
          <CardDescription>
            Datos básicos de la tarea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextInput 
            source="titulo" 
            label="Título" 
            required 
            disabled={ro("titulo")}
            placeholder="Ej: Revisar documentación"
            helperText="Título descriptivo de la tarea"
          />
          <TextInput 
            source="descripcion" 
            label="Descripción" 
            disabled={ro("descripcion")}
            placeholder="Descripción detallada de la tarea..."
            helperText="Información adicional sobre la tarea (opcional)"
            multiline
            rows={3}
          />
          <ReferenceInput
            source="user_id"
            reference="users"
            label="Usuario Asignado"
            helperText="Selecciona el usuario responsable de esta tarea"
            isRequired
          >
            <AutocompleteInput optionText="nombre" />
          </ReferenceInput>
        </CardContent>
      </Card>

      {/* Secciones Colapsables */}
      <Accordion type="multiple" defaultValue={["estado-prioridad"]} className="w-full">
        {/* Estado y Prioridad - Colapsable */}
        <AccordionItem value="estado-prioridad">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&>div]:w-full">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Estado y Prioridad</div>
                    <div className="text-sm text-muted-foreground">Configuración de estado y prioridad</div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput 
                    source="estado" 
                    label="Estado"
                    disabled={ro("estado")}
                    choices={[
                      { id: 'pendiente', name: 'Pendiente' },
                      { id: 'en_progreso', name: 'En Progreso' },
                      { id: 'completada', name: 'Completada' },
                      { id: 'cancelada', name: 'Cancelada' }
                    ]}
                    defaultValue="pendiente"
                    helperText="Estado actual de la tarea"
                  />
                  <SelectInput 
                    source="prioridad" 
                    label="Prioridad"
                    disabled={ro("prioridad")}
                    choices={[
                      { id: 'baja', name: 'Baja' },
                      { id: 'media', name: 'Media' },
                      { id: 'alta', name: 'Alta' },
                      { id: 'urgente', name: 'Urgente' }
                    ]}
                    defaultValue="media"
                    helperText="Nivel de prioridad de la tarea"
                  />
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Fechas - Colapsable */}
        <AccordionItem value="fechas">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&>div]:w-full">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Fechas</div>
                    <div className="text-sm text-muted-foreground">Configuración de fechas y plazos</div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <TextInput 
                  source="fecha_vencimiento" 
                  label="Fecha de Vencimiento" 
                  type="date"
                  disabled={ro("fecha_vencimiento")}
                  helperText="Fecha límite para completar la tarea (opcional)"
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export { TareaFields as TareaForm };
