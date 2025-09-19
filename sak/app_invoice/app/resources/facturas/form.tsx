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
import { Upload, Loader2, FileText, Braces } from "lucide-react";
import { useInput } from "ra-core";
import { useWatch, useFormContext } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";

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

// Estructura mínima del JSON extraído que nos interesa mapear
type ExtractedFactura = Partial<{
  numero: string | number;
  punto_venta: string | number;
  tipo_comprobante: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  subtotal: string | number;
  total_impuestos: string | number;
  total: string | number;
  archivo_subido: string;
  nombre_archivo_pdf: string;
}>;

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

  // Watch form values for subtitle
  const numero = useWatch({ name: "numero" });
  const puntoVenta = useWatch({ name: "punto_venta" });
  const total = useWatch({ name: "total" });
  const fechaVencimiento = useWatch({ name: "fecha_vencimiento" });
  const estado = useWatch({ name: "estado" });
  const facturaId = useWatch({ name: "id" });
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [extractedJson, setExtractedJson] = useState<string | null>(null);
  const formCtx = useFormContext();

  // Aplica los valores extraídos al formulario
  const applyDataToForm = (data: ExtractedFactura) => {
    if (!data || !formCtx?.setValue) return;
    const set = formCtx.setValue;
    const toNum = (v: unknown): number | undefined => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[\s$.A-Za-z]/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    const normDate = (v: unknown): string | undefined => {
      if (typeof v !== 'string') return undefined;
      // dd/mm/yyyy -> yyyy-mm-dd
      const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      // yyyy-mm-dd passthrough
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      return undefined;
    };
    try {
      if (data.numero !== undefined) set("numero", String(data.numero ?? ""));
      if (data.punto_venta !== undefined) set("punto_venta", String(data.punto_venta ?? ""));
      if (data.tipo_comprobante !== undefined) set("tipo_comprobante", data.tipo_comprobante ?? "");
      const emision = normDate(data.fecha_emision);
      if (emision) set("fecha_emision", emision);
      const venc = normDate(data.fecha_vencimiento);
      if (venc) set("fecha_vencimiento", venc);
      const s = toNum(data.subtotal);
      if (s !== undefined) set("subtotal", s);
      const ti = toNum(data.total_impuestos);
      if (ti !== undefined) set("total_impuestos", ti);
      const t = toNum(data.total);
      if (t !== undefined) set("total", t);
      // No intentamos setear proveedor_id/usuario_responsable_id porque requieren lookup
      // Ruta y nombre de archivo si vienen en el payload
      if (data.archivo_subido) {
        set("ruta_archivo_pdf", data.archivo_subido);
        set("nombre_archivo_pdf", data.nombre_archivo_pdf ?? data.archivo_subido);
      }
    } catch {
      // ignore
    }
  };

  const fetchLatestJson = async () => {
    // Si no hay ID aún, mostrar el JSON extraído o el estado actual del formulario
    if (!facturaId) {
      const fallback = extractedJson ?? (() => {
        try {
          const vals = formCtx?.getValues?.() ?? {};
          return JSON.stringify(vals, null, 2);
        } catch {
          return '{}';
        }
      })();
      setJsonText(fallback);
      setJsonOpen(true);
      // Si tenemos JSON extraído en memoria, aplicarlo al formulario
      if (extractedJson) {
        try {
          const obj = JSON.parse(extractedJson);
          applyDataToForm(obj);
        } catch {
          // ignore parse error
        }
      }
      return;
    }
    setJsonLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiUrl}/facturas-extracciones?sort=["created_at","DESC"]&filter=${encodeURIComponent(JSON.stringify({ factura_id: facturaId }))}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data; // router devuelve array directa
      const first = Array.isArray(items) ? items[0] : undefined;
      const payload = first?.payload_json;
      const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}, null, 2);
      setJsonText(payloadText);
      // Aplicar datos al formulario
      try {
        const obj = typeof payload === 'string' ? JSON.parse(payload) : (payload ?? {});
        applyDataToForm(obj);
      } catch {
        // ignore
      }
      setJsonOpen(true);
    } catch {
      alert('No se pudo obtener el JSON almacenado');
    } finally {
      setJsonLoading(false);
    }
  };

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

    const resp = await response.json();
      // Guardar JSON extraído para vista previa antes de grabar
      if (resp?.data) {
        try {
          setExtractedJson(JSON.stringify(resp.data, null, 2));
      // Aplicar inmediatamente al formulario
      applyDataToForm(resp.data);
        } catch {
          // ignore
        }
      }
      if (resp.data?.archivo_subido) {
        // Guardar solo el nombre del archivo, no la URL completa
        archivoField.onChange(resp.data.archivo_subido);
        nombreArchivoField.onChange(selectedFile.name);
        setUploadedFileName(selectedFile.name);
      }
    } catch {
      alert('Error al subir archivo');
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
            Cabecera
          </CardTitle>
          <CardDescription>
            {(() => {
              const numeroFormatted = numero ? numero.toString().padStart(8, '0') : '';
              const puntoVentaFormatted = puntoVenta ? puntoVenta.toString().padStart(4, '0') : '';
              const numeroCompleto = puntoVentaFormatted && numeroFormatted ? `${puntoVentaFormatted}-${numeroFormatted}` : '';
              const totalFormatted = total ? new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 2
              }).format(total) : '';
              const vencimiento = fechaVencimiento || '';
              const estadoActual = estado || '';
              
              const parts = [];
              if (numeroCompleto) parts.push(`Número: ${numeroCompleto}`);
              if (totalFormatted) parts.push(`Total: ${totalFormatted}`);
              if (vencimiento) parts.push(`Vencimiento: ${vencimiento}`);
              if (estadoActual) parts.push(`Estado: ${estadoActual}`);
              
              return parts.length > 0 ? parts.join(' • ') : 'Datos básicos del comprobante';
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
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
              size="sm"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>

            {uploadedFileName && (
              <button
                type="button"
                onClick={openPDF}
                className="text-blue-600 hover:text-blue-800"
                title={uploadedFileName}
              >
                <FileText className="h-5 w-5" />
              </button>
            )}
            <UIButton
              type="button"
              variant="ghost"
              size="sm"
              title="Ver JSON guardado"
              onClick={fetchLatestJson}
              disabled={jsonLoading}
            >
              {jsonLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Braces className="h-5 w-5" />}
            </UIButton>
          </div>
        </CardContent>
      </Card>

      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>JSON de la Factura</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-sm">
            <pre className="whitespace-pre-wrap break-words">{jsonText}</pre>
          </div>
        </DialogContent>
      </Dialog>

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
