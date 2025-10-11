// @ts-nocheck
/**
 * Extracción básica de datos de factura replicando la lógica del backend en Node/TypeScript.
 *
 * ⚠️ Dependencias requeridas (no instaladas por defecto):
 *   - pdfjs-dist (para PDFs vectoriales)
 *   - tesseract.js (para OCR)
 *   - openai (para el análisis asistido por LLM)
 *
 * La función se mantiene independiente para no interferir con el código existente.
 */

import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ExtractionMethod = "auto" | "text" | "vision" | "rules";
type ExtractionStrategy = 1 | 2; // 1 = visión directa, 2 = texto + reglas

const MAX_VISION_PAGES = 3;
const OCR_SCALE = 2;

export type FacturaExtraida = {
  numero: string;
  punto_venta: string;
  tipo_comprobante: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  proveedor_nombre: string;
  proveedor_cuit: string;
  proveedor_direccion: string | null;
  receptor_nombre: string | null;
  receptor_cuit: string | null;
  receptor_direccion: string | null;
  subtotal: number;
  total_impuestos: number;
  total: number;
  detalles: Array<Record<string, unknown>>;
  impuestos: Array<Record<string, unknown>>;
  confianza_extraccion: number;
  metodo_extraccion: string;
  metodo_aplicado: ExtractionMethod;
  texto_extraido: string;
};

const NUMBER_WITH_DECIMALS_PATTERN = "(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?|\\d+(?:,\\d{2})?)";
const CUIT_REGEX = /(\d{2}-?\d{8}-?\d)/;
const DATE_REGEX = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;

let pdfjsModulePromise: Promise<any> | null = null;

function parseNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function zeroPad(value: string, size: number): string {
  return value.padStart(size, "0");
}

function normaliseText(raw: string): string {
  return raw.replace(/\r/g, "").replace(/\u00a0/g, " ").trim();
}

class NodeCanvasFactory {
  private getCanvasModule() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- node-canvas se carga en runtime
    // eslint-disable-next-line global-require
    const module = require("canvas") as typeof import("canvas");
    if (typeof globalThis.Image === "undefined") {
      globalThis.Image = module.Image as unknown as typeof globalThis.Image;
    }
    if (typeof globalThis.ImageData === "undefined") {
      globalThis.ImageData = module.ImageData as unknown as typeof globalThis.ImageData;
    }
    return module;
  }

  create(width: number, height: number) {
    const actualWidth = Math.ceil(width);
    const actualHeight = Math.ceil(height);
    if (!(actualWidth > 0 && actualHeight > 0)) {
      throw new Error(`Canvas width/height invalido: ${actualWidth}x${actualHeight}`);
    }
    const { createCanvas } = this.getCanvasModule();
    const canvas = createCanvas(actualWidth, actualHeight);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
    const actualWidth = Math.ceil(width);
    const actualHeight = Math.ceil(height);
    canvasAndContext.canvas.width = actualWidth;
    canvasAndContext.canvas.height = actualHeight;
  }

  destroy(canvasAndContext: { canvas: any; context: any }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function getPdfJsModule() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const module = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (module?.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
      }
      return module;
    })();
  }
  return pdfjsModulePromise;
}

async function renderPdfToImages(pdfPath: string, maxPages: number = MAX_VISION_PAGES, scale: number = OCR_SCALE): Promise<Buffer[]> {
  const pdfjs = await getPdfJsModule();

  const data = await readFile(pdfPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const buffers: Buffer[] = [];
  const factory = new NodeCanvasFactory();

  for (let pageNumber = 1; pageNumber <= pdf.numPages && buffers.length < maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const { canvas, context } = factory.create(viewport.width, viewport.height);
    const renderContext = {
      canvasContext: context,
      viewport,
      canvasFactory: factory,
    };
    await page.render(renderContext).promise;
    buffers.push(canvas.toBuffer("image/png"));
    factory.destroy({ canvas, context });
  }

  return buffers;
}

function detectMetodo(extractionMethod: ExtractionMethod, isPdf: boolean, text: string): ExtractionMethod {
  if (extractionMethod === "text" || extractionMethod === "vision" || extractionMethod === "rules") {
    return extractionMethod;
  }

  // Auto: si es PDF y contiene texto suficiente usamos "text"; si no, hacemos OCR.
  const hasMeaningfulText = text.split("\n").filter((line) => line.trim().length > 6).length > 5;
  if (isPdf && hasMeaningfulText) {
    return "text";
  }
  return "vision";
}

function buildVisionPrompt(): string {
  return [
    "Eres un contador experto en facturas oficiales argentinas (normativa AFIP).",
    "Analiza las imágenes adjuntas y extrae todos los datos con la máxima precisión.",
    "",
    "Datos imprescindibles:",
    "- Tipo de comprobante (A, B, C), punto de venta y número completo del comprobante (formato PPPP-NNNNNNNN).",
    "- Datos del emisor: razón social, CUIT, domicilio, condición IVA.",
    "- Datos del receptor: nombre, CUIT, domicilio, condición IVA.",
    "- Fechas (emisión, vencimiento).",
    "- Tabla de productos/servicios: cada fila con descripción (mantén el código entre corchetes si existe), cantidad, precio unitario, subtotal.",
    "- Impuestos: IVA por alícuota, percepciones (IIBB, Otros Tributos), con porcentaje e importe.",
    "- Subtotal, total_impuestos y total (convierte separadores argentinos: 1.234,56 -> 1234.56).",
    "- CAE y fecha de vencimiento del CAE si están visibles.",
    "",
    "Formato JSON estricto:",
    JSON.stringify(
      {
        numero: "00000000",
        punto_venta: "0000",
        tipo_comprobante: "FACTURA",
        fecha_emision: "YYYY-MM-DD",
        fecha_vencimiento: "YYYY-MM-DD",
        proveedor_nombre: "nombre emisor",
        proveedor_cuit: "XX-XXXXXXXX-X",
        proveedor_direccion: "domicilio emisor",
        receptor_nombre: "nombre receptor",
        receptor_cuit: "XX-XXXXXXXX-X",
        receptor_direccion: "domicilio receptor",
        subtotal: 0,
        total_impuestos: 0,
        total: 0,
        detalles: [
          {
            descripcion: "Descripcion producto/servicio",
            cantidad: 1,
            precio_unitario: 0,
            subtotal: 0,
          },
        ],
        impuestos: [
          {
            tipo: "IVA 21%",
            porcentaje: 21,
            importe: 0,
          },
        ],
        confianza_extraccion: 0.0,
        metodo_extraccion: "llm_vision",
        texto_extraido: "detalle libre si necesitas incluir observaciones",
      },
      null,
      2,
    ),
    "",
    "Instrucciones clave:",
    "- Mantén arrays aunque tengan un único elemento.",
    "- No agregues comentarios ni texto fuera del JSON.",
    "- Convierte números a formato decimal con punto.",
    "- Preserva códigos entre corchetes dentro de las descripciones.",
    "- Si un dato no está presente, usa string vacío o null según corresponda.",
  ].join("\n");
}

function cleanModelJson(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").trim();
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3).trim();
  }
  return cleaned;
}

function extractWithRules(text: string): Partial<FacturaExtraida> {
  const rulesResult: Partial<FacturaExtraida> = {
    numero: "",
    punto_venta: "",
    tipo_comprobante: "",
    fecha_emision: "",
    proveedor_nombre: "",
    proveedor_cuit: "",
    subtotal: 0,
    total_impuestos: 0,
    total: 0,
    detalles: [],
    impuestos: [],
    texto_extraido: text,
    confianza_extraccion: 0.35,
  };

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  // Punto de venta y número (varios patrones comunes en facturas AFIP)
  const numeroPatterns = [
    /Punto\s+de\s+Venta:\s*(\d+)\s+Comp\.\s*Nro:\s*(\d+)/i,
    /Comp\.\s*Nro\s*:?\s*(\d+)-(\d+)/i,
    /FACTURA\s*[A-Z]?\s*N[º°]?\s*(\d+)-(\d+)/i,
    /FACTURA\s*N[º°]?\s*(\d+)/i,
    /N[º°]\s*(\d+)/i,
  ];

  for (const pattern of numeroPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length >= 3) {
        rulesResult.punto_venta = zeroPad(match[1], 4);
        rulesResult.numero = zeroPad(match[2], 8);
      } else if (match.length >= 2) {
        rulesResult.numero = zeroPad(match[1], 8);
      }
      break;
    }
  }

  const cuitMatch = text.match(CUIT_REGEX);
  if (cuitMatch) {
    rulesResult.proveedor_cuit = cuitMatch[1];
  }

  const dateMatch = text.match(DATE_REGEX);
  if (dateMatch) {
    const [day, month, yearRaw] = [dateMatch[1], dateMatch[2], dateMatch[3]];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw.padStart(4, "20");
    rulesResult.fecha_emision = `${year}-${zeroPad(month, 2)}-${zeroPad(day, 2)}`;
  }

  const totalPatterns = [
    new RegExp(String.raw`Importe\s*Total\s*:?\s*\$\s*${NUMBER_WITH_DECIMALS_PATTERN}`, "i"),
    new RegExp(String.raw`TOTAL\s*:?\s*\$\s*${NUMBER_WITH_DECIMALS_PATTERN}`, "i"),
    new RegExp(String.raw`Total\s*:?\s*\$\s*${NUMBER_WITH_DECIMALS_PATTERN}`, "i"),
    new RegExp(String.raw`\$\s*${NUMBER_WITH_DECIMALS_PATTERN}(?:\s|$)`, "i"),
    new RegExp(String.raw`${NUMBER_WITH_DECIMALS_PATTERN}\s*$`, "i"),
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      rulesResult.total = parseNumber(match[1]);
      break;
    }
  }

  const subtotalMatch = text.match(
    new RegExp(String.raw`Subtotal\s*:?\s*\$?\s*${NUMBER_WITH_DECIMALS_PATTERN}`, "i"),
  );
  if (subtotalMatch && subtotalMatch[1]) {
    rulesResult.subtotal = parseNumber(subtotalMatch[1]);
  }

  const ivaRegex = new RegExp(
    String.raw`IVA\s*(\d{1,2}(?:\.\d)?%?)\s*:?\s*\$?\s*${NUMBER_WITH_DECIMALS_PATTERN}`,
    "gi",
  );
  const ivaMatches = [...text.matchAll(ivaRegex)];
  const impuestos: Array<Record<string, unknown>> = [];
  let impuestosTotal = 0;
  for (const match of ivaMatches) {
    const porcentaje = match[1];
    const importe = parseNumber(match[2]);
    impuestosTotal += importe;
    impuestos.push({
      tipo: `IVA ${porcentaje}`,
      porcentaje,
      importe,
    });
  }

  const otrosTributosMatch = text.match(
    new RegExp(String.raw`Otros\s+Tributos\s*:?\s*\$?\s*${NUMBER_WITH_DECIMALS_PATTERN}`, "i"),
  );
  if (otrosTributosMatch && otrosTributosMatch[1]) {
    const importe = parseNumber(otrosTributosMatch[1]);
    impuestosTotal += importe;
    impuestos.push({
      tipo: "Otros Tributos",
      porcentaje: 0,
      importe,
    });
  }

  if (impuestosTotal > 0) {
    rulesResult.total_impuestos = impuestosTotal;
    rulesResult.impuestos = impuestos;
  }

  const tipoLookup = [
    { token: "FACTURA A", value: "A" },
    { token: "FACTURA B", value: "B" },
    { token: "FACTURA C", value: "C" },
    { token: "FACTURA M", value: "M" },
    { token: "FACTURA", value: "FACTURA" },
    { token: "TICKET", value: "TICKET" },
  ];
  const upper = text.toUpperCase();
  for (const item of tipoLookup) {
    if (upper.includes(item.token)) {
      rulesResult.tipo_comprobante = item.value;
      break;
    }
  }

  // Nombre del proveedor: buscar una línea después del título "Razón social" o cerca de "FACTURA"
  let proveedor = "";
  const razonSocialMatch = text.match(/Raz[óo]n\s+social\s*:?\s*(.+)/i);
  if (razonSocialMatch && razonSocialMatch[1]) {
    proveedor = razonSocialMatch[1]
      .replace(/CUIT:.+$/, "")
      .replace(/Domicilio:.+$/, "")
      .trim();
  } else {
    const facturaIndex = lines.findIndex((line) => /FACTURA/.test(line));
    if (facturaIndex >= 0) {
      for (let offset = 1; offset <= 3; offset += 1) {
        const candidate = lines[facturaIndex + offset];
        if (!candidate) continue;
        if (/CUIT|Domicilio|Punto de Venta/i.test(candidate)) continue;
        if (candidate.length > 3 && /[A-Za-z]/.test(candidate)) {
          proveedor = candidate;
          break;
        }
      }
    }
  }
  if (proveedor) {
    rulesResult.proveedor_nombre = proveedor;
  }

  return rulesResult;
}

async function downloadFile(url: string): Promise<{ path: string; mime: string; fileName: string }> {
  const isFileUrl = url.startsWith("file://");
  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
  const looksLikeLocalPath =
    isFileUrl ||
    !hasProtocol ||
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("../") ||
    /^[a-zA-Z]:[\\/]/.test(url);

  if (looksLikeLocalPath) {
    const resolvedPath = isFileUrl ? fileURLToPath(url) : resolve(url);
    await stat(resolvedPath);
    const fileName = basename(resolvedPath);
    const tmpPath = join(tmpdir(), `${Date.now()}-${Math.random().toString(16).slice(2)}-${fileName}`);
    const buffer = await readFile(resolvedPath);
    await writeFile(tmpPath, buffer);
    const ext = extname(fileName).toLowerCase();
    const mime =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".webp"
              ? "image/webp"
              : "";
    return { path: tmpPath, mime, fileName };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo (${response.status} ${response.statusText})`);
  }

  const fileName =
    response.headers
      .get("content-disposition")
      ?.split("filename=")
      .pop()
      ?.replace(/["']/g, "") ||
    url.split("/").pop() ||
    `factura-${Date.now()}`;

  const tmpPath = join(tmpdir(), `${Date.now()}-${Math.random().toString(16).slice(2)}-${fileName}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(tmpPath, buffer);

  return {
    path: tmpPath,
    mime: response.headers.get("content-type") ?? "",
    fileName,
  };
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  const pdfjs = await getPdfJsModule();

  const data = await readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => ("str" in item ? item.str : "")).filter(Boolean);
    text += `${strings.join("\n")}\n\n`;
  }

  return normaliseText(text);
}

async function extractTextWithOcr(filePath: string, isPdf: boolean) {
  const TesseractModule = await import("tesseract.js");
  const recognize =
    (TesseractModule as any).recognize ??
    (TesseractModule as any).default?.recognize ??
    (TesseractModule as any).default;
  if (typeof recognize !== "function") {
    throw new Error("Tesseract recognize no disponible");
  }
  const buffers = isPdf ? await renderPdfToImages(filePath, MAX_VISION_PAGES, OCR_SCALE) : [await readFile(filePath)];
  if (!buffers.length) {
    return { text: "", confidence: 0 };
  }

  const texts: string[] = [];
  const confidences: number[] = [];

  for (const buffer of buffers) {
    const result = await recognize(buffer, "spa", {
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./, ",
    });
    const rawText = normaliseText(result?.data?.text ?? "");
    if (rawText) {
      texts.push(rawText);
    }
    const rawConfidence = Number(result?.data?.confidence ?? 0);
    if (Number.isFinite(rawConfidence)) {
      confidences.push(rawConfidence / 100);
    }
  }

  const combinedText = texts.join("\n\n");
  const confidence =
    confidences.length > 0
      ? Math.min(1, Math.max(0, confidences.reduce((acc, value) => acc + value, 0) / confidences.length))
      : 0.5;

  return {
    text: normaliseText(combinedText),
    confidence,
  };
}

async function extractWithLlm(text: string, metodo: ExtractionMethod): Promise<Partial<FacturaExtraida>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {};
  }

  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const metodoExtraccion = metodo === "vision" ? "llm_vision" : "llm_text";

  const prompt = `
Eres un contador especializado en facturas oficiales argentinas. Extrae TODOS los datos relevantes de la factura y respóndeme con JSON válido (sin comentarios) usando esta estructura exacta:
{
  "numero": string,
  "punto_venta": string,
  "tipo_comprobante": string,
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD" | null,
  "proveedor_nombre": string,
  "proveedor_cuit": string,
  "proveedor_direccion": string | null,
  "receptor_nombre": string | null,
  "receptor_cuit": string | null,
  "receptor_direccion": string | null,
  "subtotal": number,
  "total_impuestos": number,
  "total": number,
  "detalles": [{ "descripcion": string, "cantidad": number, "precio_unitario": number, "subtotal": number }],
  "impuestos": [{ "tipo": string, "porcentaje": number | string, "importe": number }],
  "confianza_extraccion": number,
  "metodo_extraccion": "${metodoExtraccion}",
  "texto_extraido": string
}

Utiliza coma decimal como punto (.) en los números y rellena con cadenas vacías cuando falte información.

Texto a analizar:
${text.slice(0, 6000)}
`;

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: prompt,
    temperature: 0.1,
    max_output_tokens: 1800,
    text: { format: { type: "json_object" } },
  });

  const jsonText = response.output_text?.trim();
  if (!jsonText) {
    return {};
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed.metodo_extraccion) {
      parsed.metodo_extraccion = metodoExtraccion;
    }
    return parsed;
  } catch {
    return {};
  }
}

async function extractWithVisionStrategy(filePath: string, originalFilename: string): Promise<Partial<FacturaExtraida>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada para estrategia de visión");
  }

  const images = await renderPdfToImages(filePath, MAX_VISION_PAGES, OCR_SCALE);
  if (!images.length) {
    throw new Error("No se pudieron renderizar páginas del PDF para la estrategia de visión");
  }

  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const imageParts = images.map((buffer) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/png;base64,${buffer.toString("base64")}`,
      detail: "high" as const,
    },
  }));

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          "Eres un contador argentino especializado en facturas oficiales AFIP. Debes devolver únicamente JSON válido con los datos solicitados.",
      },
      {
        role: "user",
        content: [{ type: "text", text: buildVisionPrompt() }, ...imageParts],
      },
    ],
  });

  const messageContent = response.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error("OpenAI no devolvió contenido en la respuesta de visión");
  }

  const jsonText =
    typeof messageContent === "string"
      ? cleanModelJson(messageContent)
      : cleanModelJson(
          messageContent
            .map((segment: any) => ("text" in segment ? segment.text : segment))
            .filter(Boolean)
            .join("\n"),
        );

  const parsed = JSON.parse(jsonText) as Partial<FacturaExtraida>;

  parsed.metodo_extraccion = "llm_vision";
  parsed.metodo_aplicado = "vision";
  parsed.texto_extraido =
    parsed.texto_extraido ?? `Procesado mediante análisis visual (${images.length} página${images.length > 1 ? "s" : ""})`;
  parsed.numero = parsed.numero ?? "";
  parsed.punto_venta = parsed.punto_venta ?? "";
  parsed.tipo_comprobante = parsed.tipo_comprobante ?? "";
  parsed.fecha_emision = parsed.fecha_emision ?? "";
  parsed.fecha_vencimiento = parsed.fecha_vencimiento ?? null;
  parsed.proveedor_nombre = parsed.proveedor_nombre ?? "";
  parsed.proveedor_cuit = parsed.proveedor_cuit ?? "";
  parsed.proveedor_direccion = parsed.proveedor_direccion ?? null;
  parsed.receptor_nombre = parsed.receptor_nombre ?? null;
  parsed.receptor_cuit = parsed.receptor_cuit ?? null;
  parsed.receptor_direccion = parsed.receptor_direccion ?? null;
  parsed.subtotal = Number(parsed.subtotal ?? 0) || 0;
  parsed.total_impuestos = Number(parsed.total_impuestos ?? 0) || 0;
  parsed.total = Number(parsed.total ?? 0) || 0;
  parsed.detalles = Array.isArray(parsed.detalles) ? parsed.detalles : [];
  parsed.impuestos = Array.isArray(parsed.impuestos) ? parsed.impuestos : [];
  parsed.confianza_extraccion = Number(parsed.confianza_extraccion ?? 0.85) || 0.85;

  return parsed;
}

function mergeResults(
  base: Partial<FacturaExtraida>,
  override: Partial<FacturaExtraida>,
  defaults: Partial<FacturaExtraida>,
): FacturaExtraida {
  const combined = {
    ...defaults,
    ...base,
    ...override,
  } as FacturaExtraida;

  combined.numero = combined.numero ?? "";
  combined.punto_venta = combined.punto_venta ?? "";
  combined.tipo_comprobante = combined.tipo_comprobante ?? "";
  combined.fecha_emision = combined.fecha_emision ?? "";
  combined.fecha_vencimiento = combined.fecha_vencimiento ?? null;
  combined.proveedor_nombre = combined.proveedor_nombre ?? "";
  combined.proveedor_cuit = combined.proveedor_cuit ?? "";
  combined.proveedor_direccion = combined.proveedor_direccion ?? null;
  combined.receptor_nombre = combined.receptor_nombre ?? null;
  combined.receptor_cuit = combined.receptor_cuit ?? null;
  combined.receptor_direccion = combined.receptor_direccion ?? null;
  combined.subtotal = Number(combined.subtotal ?? 0) || 0;
  combined.total_impuestos = Number(combined.total_impuestos ?? 0) || 0;
  combined.total = Number(combined.total ?? 0) || 0;
  combined.detalles = Array.isArray(combined.detalles) ? combined.detalles : [];
  combined.impuestos = Array.isArray(combined.impuestos) ? combined.impuestos : [];
  combined.confianza_extraccion = Number(combined.confianza_extraccion ?? 0.4) || 0.4;
  combined.metodo_extraccion = combined.metodo_extraccion ?? defaults.metodo_extraccion ?? "rules";
  combined.texto_extraido = combined.texto_extraido ?? defaults.texto_extraido ?? "";
  return combined;
}

/**
 * Extrae datos estructurados de una factura a partir de la URL del archivo.
 * Mantiene la lógica del backend (texto ⇄ OCR ⇄ LLM ⇄ reglas) en una función independiente.
 */

export async function extractFacturaFromUrl(
  fileUrl: string,
  strategyOrMethod?: ExtractionStrategy | ExtractionMethod,
  maybeExtractionMethod?: ExtractionMethod,
): Promise<FacturaExtraida> {
  let strategy: ExtractionStrategy = 2;
  let extractionMethod: ExtractionMethod = "auto";

  if (typeof strategyOrMethod === "number") {
    strategy = strategyOrMethod;
    extractionMethod = maybeExtractionMethod ?? "auto";
  } else if (typeof strategyOrMethod === "string") {
    extractionMethod = strategyOrMethod;
  }

  if (strategy !== 1 && strategy !== 2) {
    strategy = 2;
  }

  const download = await downloadFile(fileUrl);
  const isPdf = download.mime.includes("pdf") || download.fileName.toLowerCase().endsWith(".pdf");

  let metodoAplicado: ExtractionMethod = extractionMethod;
  let textoExtraido = "";
  let confianza = 0.35;

  try {
    if (strategy === 1) {
      try {
        const visionResult = await extractWithVisionStrategy(download.path, download.fileName);
        if (!visionResult.texto_extraido || visionResult.texto_extraido.length < 50) {
          try {
            const visionOcr = await extractTextWithOcr(download.path, isPdf);
            if (visionOcr.text && visionOcr.text.length > (visionResult.texto_extraido?.length ?? 0)) {
              visionResult.texto_extraido = visionOcr.text;
            }
          } catch {
            // Ignorar errores de OCR en la v?a visi?n
          }
        }
        return mergeResults(
          {},
          visionResult,
          {
            numero: "",
            punto_venta: "",
            tipo_comprobante: "",
            fecha_emision: "",
            fecha_vencimiento: null,
            proveedor_nombre: "",
            proveedor_cuit: "",
            proveedor_direccion: null,
            receptor_nombre: null,
            receptor_cuit: null,
            receptor_direccion: null,
            subtotal: 0,
            total_impuestos: 0,
            total: 0,
            detalles: [],
            impuestos: [],
            texto_extraido: visionResult.texto_extraido ?? "",
            confianza_extraccion: visionResult.confianza_extraccion ?? 0.85,
            metodo_extraccion: "llm_vision",
            metodo_aplicado: "vision",
          },
        );
      } catch (visionError) {
        console.warn("Fallo estrategia de visi?n, continuando con extracci?n de texto:", visionError);
      }
    }

    if (isPdf) {
      textoExtraido = await extractTextFromPdf(download.path);
    }

    metodoAplicado = detectMetodo(extractionMethod, isPdf, textoExtraido);

    const canFallbackToVision = extractionMethod !== "text" && extractionMethod !== "rules";
    const textIsWeak =
      !textoExtraido ||
      textoExtraido.length < 400 ||
      (!/FACTURA/i.test(textoExtraido) && !/TOTAL/i.test(textoExtraido));

    if (metodoAplicado === "vision" || (canFallbackToVision && textIsWeak)) {
      const ocr = await extractTextWithOcr(download.path, isPdf);
      if (ocr.text) {
        const preferOcr = !textoExtraido || ocr.text.length > textoExtraido.length || !/CAE/i.test(textoExtraido);
        if (preferOcr) {
          textoExtraido = ocr.text;
          metodoAplicado = "vision";
        }
      }
      confianza = Math.max(confianza, ocr.confidence ?? confianza);
    }

    const headSection = textoExtraido.slice(0, 200).toUpperCase();
    if (isPdf && textoExtraido) {
      const looksIncomplete =
        !/^\s*(?:A\s+)?FACTURA/i.test(textoExtraido.slice(0, 80)) || headSection.startsWith("SUBTOTAL");
      try {
        const supplementalOcr = await extractTextWithOcr(download.path, isPdf);
        if (supplementalOcr.text) {
          const supplementalClean = supplementalOcr.text.trim();
          if (supplementalClean) {
            const supplementalLooksBetter =
              looksIncomplete ||
              supplementalClean.length > textoExtraido.length ||
              !/^\s*(?:A\s+)?FACTURA/i.test(textoExtraido.slice(0, 80));
            if (supplementalLooksBetter) {
              textoExtraido = supplementalClean;
            } else {
              const combinedTexto = [textoExtraido, supplementalClean].join("\n\n");
              if (combinedTexto.length > textoExtraido.length) {
                textoExtraido = combinedTexto;
              }
            }
            confianza = Math.max(confianza, supplementalOcr.confidence ?? confianza);
          }
        }
      } catch {
        // ignorar si el OCR suplementario falla
      }
    }
    if (!textoExtraido) {
      throw new Error("No se pudo extraer texto del archivo");
    }

    const rulesResult = extractWithRules(textoExtraido);
    const llmResult = await extractWithLlm(textoExtraido, metodoAplicado);
    const llmMetodo = metodoAplicado === "vision" ? "llm_vision" : "llm_text";
    const baselineConfidence = metodoAplicado === "vision" ? 0.75 : 0.8;

    const defaults: Partial<FacturaExtraida> = {
      numero: "",
      punto_venta: "",
      tipo_comprobante: "",
      fecha_emision: "",
      fecha_vencimiento: null,
      proveedor_nombre: "",
      proveedor_cuit: "",
      proveedor_direccion: null,
      receptor_nombre: null,
      receptor_cuit: null,
      receptor_direccion: null,
      subtotal: 0,
      total_impuestos: 0,
      total: 0,
      detalles: [],
      impuestos: [],
      texto_extraido: textoExtraido,
      confianza_extraccion: Math.max(confianza, rulesResult.confianza_extraccion ?? 0.4, baselineConfidence),
      metodo_extraccion: llmMetodo,
      metodo_aplicado: metodoAplicado,
    };

    const merged = mergeResults(rulesResult, llmResult, defaults);
    merged.metodo_aplicado = metodoAplicado;
    merged.metodo_extraccion = merged.metodo_extraccion ?? llmMetodo;
    merged.confianza_extraccion = Math.max(baselineConfidence, rulesResult.confianza_extraccion ?? 0.4, confianza);
    merged.texto_extraido = textoExtraido;

    if (typeof rulesResult.total === "number" && rulesResult.total > 0) {
      if (!merged.total || rulesResult.total > merged.total) {
        merged.total = rulesResult.total;
      }
    }
    if (typeof rulesResult.subtotal === "number" && rulesResult.subtotal > 0 && (!merged.subtotal || merged.subtotal === 0)) {
      merged.subtotal = rulesResult.subtotal;
    }

    const reglasImpuestos = Array.isArray(rulesResult.impuestos) ? rulesResult.impuestos : [];
    const mergedImpuestos = Array.isArray(merged.impuestos) ? merged.impuestos : [];
    if (reglasImpuestos.length > 0 && mergedImpuestos.length === 0) {
      merged.impuestos = reglasImpuestos;
      if (typeof rulesResult.total_impuestos === "number" && rulesResult.total_impuestos > 0) {
        merged.total_impuestos = rulesResult.total_impuestos;
      }
    } else if ((!merged.total_impuestos || merged.total_impuestos === 0) && typeof rulesResult.total_impuestos === "number") {
      merged.total_impuestos = rulesResult.total_impuestos;
    }

    const reglasDetalles = Array.isArray(rulesResult.detalles) ? rulesResult.detalles : [];
    if (reglasDetalles.length > 0 && (!Array.isArray(merged.detalles) || merged.detalles.length === 0)) {
      merged.detalles = reglasDetalles;
    }

    if (Array.isArray(merged.impuestos)) {
      merged.impuestos = merged.impuestos.map((item) => {
        if (!item) return item;
        const normalised: Record<string, unknown> = { ...item };
        const rawPorcentaje = normalised.porcentaje;
        let porcentajeNumber =
          typeof rawPorcentaje === "number"
            ? rawPorcentaje
            : typeof rawPorcentaje === "string" && rawPorcentaje.trim() !== ""
              ? Number.parseFloat(rawPorcentaje.replace("%", "").replace(",", "."))
              : NaN;
        if (Number.isNaN(porcentajeNumber)) {
          porcentajeNumber = 0;
        }
        normalised.porcentaje = porcentajeNumber;
        if (typeof normalised.importe === "string") {
          normalised.importe = parseNumber(normalised.importe);
        }
        if (typeof normalised.tipo === "string") {
          const upperTipo = normalised.tipo.toUpperCase();
          if (upperTipo === "IVA" && porcentajeNumber) {
            normalised.tipo = `IVA ${porcentajeNumber}%`;
          }
        }
        return normalised;
      });
    }

    if (Array.isArray(merged.detalles) && merged.detalles.length > 0) {
      const codeMatches = textoExtraido.match(/\[[^\]]+\]/g) ?? [];
      merged.detalles = merged.detalles.map((detalle, index) => {
        if (!detalle || typeof detalle.descripcion !== "string") {
          return detalle;
        }

        let descripcion = detalle.descripcion
          .replace(/\[([^\]]+)\]\s*/g, (__, inner) => `${inner} `)
          .replace(/\s+/g, " ")
          .trim();

        const code = codeMatches[Math.min(index, codeMatches.length - 1)];
        if (code) {
          const rawCode = code.replace(/[\[\]]/g, "");
          const descripcionUpper = descripcion.toUpperCase();
          if (!descripcionUpper.includes(rawCode.toUpperCase())) {
            descripcion = `${rawCode} ${descripcion}`.trim();
          }
        }

        descripcion = descripcion.replace(/\[([^\]]+)\]/g, (_, inner) => inner).trim();
        descripcion = descripcion.replace(/^([A-Z0-9-]+)\s+([A-Z0-9-]+)\b/i, (match, first, second) => {
          return first.toUpperCase() === second.toUpperCase() ? first : match;
        });

        return { ...detalle, descripcion } as typeof detalle;
      });
    }

    if (merged.texto_extraido) {
      const lines = merged.texto_extraido.split(/\r?\n/);
      const facturaLineIndex = lines.findIndex((line) => /FACTURA/.test(line.toUpperCase()));
      if (facturaLineIndex > -1) {
        let headerStart = facturaLineIndex;
        while (headerStart > 0) {
          const previous = lines[headerStart - 1].trim();
          if (!previous || /^[0-9\s.,$-]+$/.test(previous)) {
            break;
          }
          headerStart -= 1;
        }
        let headerEnd = facturaLineIndex;
        while (headerEnd < lines.length && lines[headerEnd].trim() !== "") {
          headerEnd += 1;
        }
        const headerBlock = lines.slice(headerStart, headerEnd);
        const remaining = [...lines.slice(0, headerStart), ...lines.slice(headerEnd)];
        const reordered = [...headerBlock, "", ...remaining].join("\n");
        merged.texto_extraido = reordered.replace(/\n{3,}/g, "\n\n").trim();
      }
    }

    if (merged.tipo_comprobante) {
      const upperTipo = merged.tipo_comprobante.toUpperCase();
      const match = upperTipo.match(/FACTURA\s+([A-Z])/);
      if (match) {
        merged.tipo_comprobante = match[1];
      } else if (upperTipo.length === 1) {
        merged.tipo_comprobante = upperTipo;
      }
    }

    return merged;
  } finally {
    await unlink(download.path).catch(() => undefined);
  }
}
