"use client";

import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { BooleanInput } from "@/components/boolean-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReferenceInput } from "@/components/reference-input";
import { SelectInput } from "@/components/select-input";

type Mode = "create" | "edit";
type FacturaValues = {
  numero: string;
  punto_venta: string;
  tipo_comprobante: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  subtotal: number;
  total_impuestos: number;
  total: number;
  estado: string;
  observaciones?: string;
  proveedor_id: number;
  tipo_operacion_id: number;
  nombre_archivo_pdf?: string;
  ruta_archivo_pdf?: string;
  extraido_por_ocr: boolean;
  extraido_por_llm: boolean;
  confianza_extraccion?: number;
};

const READ_ONLY_ON_EDIT = new Set<keyof FacturaValues>([
  "numero", // El número de factura no se puede cambiar
  "punto_venta",
  "proveedor_id", // El proveedor no se puede cambiar una vez creada
]);

export function FacturaFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof FacturaValues) => isEdit && READ_ONLY_ON_EDIT.has(name);

  return (
    <div className="space-y-6">
      {/* Información Básica - Siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Información de la Factura
          </CardTitle>
          <CardDescription>
            Datos básicos de identificación de la factura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextInput 
              source="numero" 
              label="Número de Factura"
              required 
              readOnly={ro("numero")}
              placeholder="0001-00000001"
              helperText="Número completo de la factura"
            />
            <TextInput 
              source="punto_venta" 
              label="Punto de Venta"
              required 
              readOnly={ro("punto_venta")}
              placeholder="0001"
              helperText="Punto de venta"
            />
            <SelectInput 
              source="tipo_comprobante" 
              label="Tipo de Comprobante"
              isRequired
              choices={[
                { id: "A", name: "Factura A" },
                { id: "B", name: "Factura B" },
                { id: "C", name: "Factura C" },
                { id: "M", name: "Factura M" },
                { id: "NC", name: "Nota de Crédito" },
                { id: "ND", name: "Nota de Débito" }
              ]}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              source="fecha_emision" 
              label="Fecha de Emisión"
              type="date"
              required
              helperText="Fecha en que se emitió la factura"
            />
            <TextInput 
              source="fecha_vencimiento" 
              label="Fecha de Vencimiento"
              type="date"
              helperText="Fecha límite de pago (opcional)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Secciones Colapsibles */}
      <Accordion type="multiple" defaultValue={["proveedor", "importes"]} className="w-full">
        
        {/* Sección Proveedor */}
        <AccordionItem value="proveedor">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="font-medium">Proveedor y Tipo de Operación</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Datos del Proveedor</CardTitle>
                <CardDescription>
                  Seleccione el proveedor y tipo de operación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ReferenceInput 
                    source="proveedor_id" 
                    reference="proveedores" 
                    label="Proveedor"
                    isRequired
                    readOnly={ro("proveedor_id")}
                  >
                    <SelectInput 
                      emptyText="Seleccionar proveedor" 
                      optionText="nombre"
                      helperText="Proveedor de la factura"
                    />
                  </ReferenceInput>
                  
                  <ReferenceInput 
                    source="tipo_operacion_id" 
                    reference="tipos-operacion" 
                    label="Tipo de Operación"
                    isRequired
                  >
                    <SelectInput 
                      emptyText="Seleccionar tipo" 
                      optionText="descripcion"
                      helperText="Tipo de operación fiscal"
                    />
                  </ReferenceInput>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Sección Importes */}
        <AccordionItem value="importes">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span className="font-medium">Importes y Totales</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Importes de la Factura</CardTitle>
                <CardDescription>
                  Subtotales, impuestos y total general
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumberInput 
                    source="subtotal" 
                    label="Subtotal"
                    required
                    step={0.01}
                    min={0}
                    helperText="Importe sin impuestos"
                  />
                  <NumberInput 
                    source="total_impuestos" 
                    label="Total Impuestos"
                    required
                    step={0.01}
                    min={0}
                    helperText="Suma de todos los impuestos"
                  />
                  <NumberInput 
                    source="total" 
                    label="Total General"
                    required
                    step={0.01}
                    min={0}
                    helperText="Importe total de la factura"
                  />
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Sección Estado y Observaciones */}
        <AccordionItem value="estado">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Estado y Observaciones</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Estado de Procesamiento</CardTitle>
                <CardDescription>
                  Estado actual y observaciones adicionales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SelectInput 
                    source="estado" 
                    label="Estado"
                    isRequired
                    choices={[
                      { id: "pendiente", name: "Pendiente" },
                      { id: "procesada", name: "Procesada" },
                      { id: "pagada", name: "Pagada" },
                      { id: "anulada", name: "Anulada" }
                    ]}
                  />
                </div>
                
                <TextInput 
                  source="observaciones" 
                  label="Observaciones"
                  multiline
                  rows={3}
                  placeholder="Observaciones adicionales sobre la factura..."
                  helperText="Comentarios opcionales"
                />
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Sección Archivo PDF */}
        <AccordionItem value="archivo">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">Archivo PDF y Extracción</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Archivo Original</CardTitle>
                <CardDescription>
                  PDF de la factura y datos de extracción automática
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput 
                    source="nombre_archivo_pdf" 
                    label="Nombre del Archivo"
                    readOnly
                    helperText="Nombre original del archivo PDF"
                  />
                  <TextInput 
                    source="ruta_archivo_pdf" 
                    label="Ruta del Archivo"
                    readOnly
                    helperText="Ubicación del archivo en el servidor"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <BooleanInput 
                      source="extraido_por_ocr" 
                      label="Extraído por OCR"
                      readOnly
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <BooleanInput 
                      source="extraido_por_llm" 
                      label="Procesado por LLM"
                      readOnly
                    />
                  </div>
                  <NumberInput 
                    source="confianza_extraccion" 
                    label="Confianza (%)"
                    readOnly
                    step={0.01}
                    min={0}
                    max={1}
                    helperText="Nivel de confianza de la extracción"
                  />
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
