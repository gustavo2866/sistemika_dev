"use client";

import { useState, useEffect } from "react";
import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { SelectInput } from "@/components/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { useInput } from "ra-core";

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
  ruta_archivo_pdf?: string;
  nombre_archivo_pdf?: string;
  proveedor_id: number;
  tipo_operacion_id: number;
  usuario_responsable_id: number;
};

const READ_ONLY_ON_EDIT = new Set<keyof FacturaValues>([
  "numero", // El número de factura no se puede cambiar
  "proveedor_id", // El proveedor no se puede cambiar una vez creada
]);

export function FacturaFields({ mode }: { mode: Mode }) {
  const isEdit = mode === "edit";
  const ro = (name: keyof FacturaValues) => isEdit && READ_ONLY_ON_EDIT.has(name);
  
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const { field: archivoField } = useInput({ source: "ruta_archivo_pdf" });
  const { field: nombreArchivoField } = useInput({ source: "nombre_archivo_pdf" });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileType = selectedFile.type.toLowerCase();
    const fileName = selectedFile.name.toLowerCase();
    
    const isValidFile = (
      fileType === 'application/pdf' || fileName.endsWith('.pdf') ||
      fileType.startsWith('image/') ||
      fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ||
      fileName.endsWith('.png') || fileName.endsWith('.gif') ||
      fileName.endsWith('.webp') || fileName.endsWith('.bmp') ||
      fileName.endsWith('.tiff')
    );
    
    if (!isValidFile) {
      alert('Por favor selecciona un archivo PDF o imagen válido');
      e.target.value = '';
      return;
    }

    // Upload inmediatamente
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('extraction_method', 'auto');

    try {
      const response = await fetch('http://localhost:8000/api/v1/facturas/parse-pdf/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.data?.archivo_subido) {
        // Guardar solo el nombre del archivo, no la URL completa
        archivoField.onChange(data.data.archivo_subido);
        nombreArchivoField.onChange(selectedFile.name);
        setUploadedFileName(selectedFile.name);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al subir archivo');
    } finally {
      setUploading(false);
      e.target.value = ''; // Limpiar input para permitir reselección
    }
  };

  const triggerFileSelect = () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    fileInput?.click();
  };

  const openPDF = () => {
    if (archivoField.value) {
      // Construir URL completa como en la lista
      const pdfUrl = `http://localhost:8000/uploads/facturas/${archivoField.value}`;
      window.open(pdfUrl, '_blank');
    }
  };

  // Inicializar nombre del archivo si ya existe
  useEffect(() => {
    if (nombreArchivoField.value && !uploadedFileName) {
      setUploadedFileName(nombreArchivoField.value);
    }
  }, [nombreArchivoField.value, uploadedFileName]);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Subir Factura
          </CardTitle>
          <CardDescription>
            Sube el archivo PDF de la factura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Archivo PDF o Imagen</Label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,image/*,application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button 
              type="button"
              onClick={triggerFileSelect} 
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Archivo
                </>
              )}
            </Button>

            {uploadedFileName && (
              <button
                type="button"
                onClick={openPDF}
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                {uploadedFileName}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información de la Factura - Siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Información de la Factura
          </CardTitle>
          <CardDescription>
            Datos básicos del comprobante
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectInput 
            source="tipo_comprobante" 
            label="Tipo de Comprobante"
            isRequired
            choices={[
              { id: "A", name: "A - Factura A" },
              { id: "B", name: "B - Factura B" },
              { id: "C", name: "C - Factura C" },
              { id: "E", name: "E - Factura E" }
            ]}
          />
          
          <TextInput 
            source="numero" 
            label="Número de Comprobante" 
            required 
            disabled={ro("numero")}
            placeholder="Ej: 00000123"
          />
          
          <TextInput 
            source="punto_venta" 
            label="Punto de Venta" 
            required 
            placeholder="Ej: 0001"
          />
          
          <TextInput 
            source="fecha_emision" 
            label="Fecha de Emisión" 
            type="date"
            required 
          />
          
          <TextInput 
            source="fecha_vencimiento" 
            label="Fecha de Vencimiento" 
            type="date"
          />

          <ReferenceInput
            source="proveedor_id"
            reference="proveedores"
            label="Proveedor"
            isRequired
            disabled={ro("proveedor_id")}
          >
            <AutocompleteInput optionText="razon_social" />
          </ReferenceInput>
        </CardContent>
      </Card>

      {/* Secciones Colapsables */}
      <Accordion type="multiple" defaultValue={["importes"]} className="w-full">
        {/* Importes - Colapsable */}
        <AccordionItem value="importes">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&>div]:w-full">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Importes</div>
                    <div className="text-sm text-muted-foreground">Subtotal, impuestos y total</div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <NumberInput 
                    source="subtotal" 
                    label="Subtotal"
                    required
                    step={0.01}
                  />
                  <NumberInput 
                    source="total_impuestos" 
                    label="Total Impuestos"
                    required
                    step={0.01}
                  />
                  <NumberInput 
                    source="total" 
                    label="Total"
                    required
                    step={0.01}
                  />
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Gestión - Colapsable */}
        <AccordionItem value="gestion">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&>div]:w-full">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Gestión</div>
                    <div className="text-sm text-muted-foreground">Operación, usuario responsable y estado</div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <ReferenceInput 
                    source="tipo_operacion_id" 
                    reference="tipos-operacion" 
                    label="Tipo de Operación"
                    isRequired
                  >
                    <AutocompleteInput optionText="descripcion" />
                  </ReferenceInput>
                  
                  <ReferenceInput 
                    source="usuario_responsable_id" 
                    reference="users" 
                    label="Usuario Responsable"
                    isRequired
                  >
                    <AutocompleteInput optionText="nombre" />
                  </ReferenceInput>
                
                  <SelectInput 
                    source="estado" 
                    label="Estado"
                    isRequired
                    choices={[
                      { id: "pendiente", name: "Pendiente" },
                      { id: "procesada", name: "Procesada" },
                      { id: "aprobada", name: "Aprobada" },
                      { id: "rechazada", name: "Rechazada" },
                      { id: "pagada", name: "Pagada" },
                      { id: "anulada", name: "Anulada" }
                    ]}
                    defaultValue="pendiente"
                  />
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Observaciones - Colapsable */}
        <AccordionItem value="observaciones">
          <Card>
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&>div]:w-full">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Observaciones</div>
                    <div className="text-sm text-muted-foreground">Notas adicionales</div>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <TextInput 
                  source="observaciones" 
                  label="Observaciones" 
                  placeholder="Notas adicionales sobre la factura..."
                  multiline
                  rows={3}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export { FacturaFields as FacturaForm };
