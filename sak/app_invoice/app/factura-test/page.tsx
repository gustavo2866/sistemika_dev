"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface FacturaData {
  numero: string
  proveedor_nombre: string
  fecha_emision: string
  total: number
  metodo_extraccion: string
  texto_extraido?: string
  archivo_subido?: string
  [key: string]: unknown
}

interface FacturaResult {
  success: boolean
  message: string
  data: FacturaData
}

export default function FacturaTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FacturaResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] = useState<string>("auto")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileType = selectedFile.type.toLowerCase()
      const fileName = selectedFile.name.toLowerCase()
      
      // Verificar si es un tipo válido
      const isValidFile = (
        // PDFs
        fileType === 'application/pdf' || fileName.endsWith('.pdf') ||
        // Imágenes
        fileType.startsWith('image/') ||
        fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') || fileName.endsWith('.gif') ||
        fileName.endsWith('.webp') || fileName.endsWith('.bmp') ||
        fileName.endsWith('.tiff')
      )
      
      if (isValidFile) {
        setFile(selectedFile)
        setResult(null)
        setError(null)
      } else {
        setError('Por favor selecciona un archivo PDF o imagen válido (.pdf, .jpg, .jpeg, .png, .gif, .webp)')
        e.target.value = '' // Limpiar input
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('extraction_method', extractionMethod)

    try {
      const response = await fetch('http://localhost:8000/api/v1/facturas/parse-pdf/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToDatabase = async () => {
    if (!result) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8000/api/v1/facturas/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      alert('Factura guardada exitosamente con ID: ' + data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Factura Test</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Subir Factura PDF
            </CardTitle>
            <CardDescription>
              Selecciona un archivo PDF de factura para procesarlo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Archivo PDF o Imagen</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,image/*,application/pdf"
                onChange={handleFileChange}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                📄 <strong>PDFs:</strong> .pdf | 🖼️ <strong>Imágenes:</strong> .jpg, .jpeg, .png, .gif, .webp, .bmp, .tiff
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Método de Extracción</Label>
              <Select value={extractionMethod} onValueChange={setExtractionMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🤖 Automático (Recomendado)</SelectItem>
                  <SelectItem value="text">📝 Texto + LLM (Rápido)</SelectItem>
                  <SelectItem value="vision">👁️ Visión GPT-4o (Preciso)</SelectItem>
                  <SelectItem value="rules">⚙️ Solo Reglas (Básico)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {extractionMethod === "auto" && "Selecciona automáticamente el mejor método según el tipo de archivo"}
                {extractionMethod === "text" && "Extrae texto y usa GPT-3.5-turbo (~$0.001) - Ideal para PDFs con texto"}
                {extractionMethod === "vision" && "Usa GPT-4o Vision para analizar la imagen (~$0.01) - Ideal para imágenes y PDFs escaneados"}
                {extractionMethod === "rules" && "Solo patrones regex, sin IA (gratis)"}
              </p>
            </div>

            {file && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Archivo seleccionado:</strong> {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Procesar Factura
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado del Procesamiento</CardTitle>
            <CardDescription>
              Datos extraídos de la factura
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Factura procesada exitosamente
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Datos Extraídos (JSON)</Label>
                    {result.data?.archivo_subido && (
                      <a 
                        href={`http://localhost:8000/uploads/facturas/${result.data.archivo_subido}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver PDF
                      </a>
                    )}
                  </div>
                  <Textarea
                    value={JSON.stringify(result, null, 2)}
                    readOnly
                    className="h-64 font-mono text-sm"
                  />
                </div>

                <Button 
                  onClick={handleSaveToDatabase}
                  disabled={loading}
                  className="w-full"
                  variant="secondary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Guardar en Base de Datos
                    </>
                  )}
                </Button>
              </div>
            )}

            {!result && !error && (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sube un archivo PDF para ver los resultados aquí</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Texto Extraído Section */}
      {result && result.data?.texto_extraido && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Texto Extraído del PDF
            </CardTitle>
            <CardDescription>
              Texto raw extraído del PDF antes del procesamiento semántico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Contenido del PDF</Label>
                <span className="text-sm text-muted-foreground">
                  {result.data.texto_extraido.length} caracteres
                </span>
              </div>
              <Textarea
                value={result.data.texto_extraido}
                readOnly
                className="h-64 font-mono text-sm"
                placeholder="Aquí aparecerá el texto extraído del PDF..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <h3 className="font-medium">Seleccionar Archivo</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Elige un archivo PDF de factura desde tu computadora
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <h3 className="font-medium">Procesar</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                El sistema extraerá automáticamente los datos de la factura
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <h3 className="font-medium">Revisar y Guardar</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Revisa los datos extraídos y guárdalos en la base de datos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
