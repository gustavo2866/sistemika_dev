// DataProvider para API REST estándar (FastAPI)
import { fetchUtils, DataProvider } from 'ra-core';
import simpleRestProvider from 'ra-data-simple-rest';

// httpClient con logging para diagnosticar errores HTTP y peticiones
const httpClient: typeof fetchUtils.fetchJson = (url: string, options: RequestInit = {}) => {
  const method = (options?.method || 'GET').toUpperCase();

  // Preparar detalles de headers y body para logging
  const headers = options?.headers as Headers | Record<string, string> | undefined;
  let contentType: string | undefined;
  if (headers instanceof Headers) {
    contentType = headers.get('Content-Type') ?? headers.get('content-type') ?? undefined;
  } else if (headers && typeof headers === 'object') {
    const h = headers as Record<string, string>;
    contentType = h['Content-Type'] || h['content-type'];
  }

  let bodyLog: unknown = undefined;
  if (options?.body) {
    // Intentar loguear el body de forma segura
    if (typeof options.body === 'string') {
      bodyLog = (() => {
        try {
          return JSON.parse(options.body as string);
        } catch {
          return options.body;
        }
      })();
    } else if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      // No imprimimos binarios, solo las claves presentes
      const entries: Record<string, unknown> = {};
      (options.body as FormData).forEach((value, key) => {
        if (value instanceof File) {
          entries[key] = { fileName: value.name, size: value.size, type: value.type };
        } else {
          entries[key] = value;
        }
      });
      bodyLog = { formData: entries };
    } else {
      bodyLog = '<non-serializable body>';
    }
  }

  // Log de salida de todas las requests
  // Nota: en Next.js (dev) esto se verá en la consola del servidor
  if (bodyLog !== undefined) {
    console.log(`[HTTP] → ${method} ${url}`, { headers: contentType ? { 'Content-Type': contentType } : undefined, body: bodyLog });
  } else {
    console.log(`[HTTP] → ${method} ${url}`);
  }

  return fetchUtils
    .fetchJson(url, options)
    .then((res) => {
      // Log de respuesta OK con status
      // fetchJson devuelve { status, headers, body, json }
      const status = (res as { status?: number })?.status ?? 'OK';
      console.log(`[HTTP] ← ${method} ${url} :: ${status}`);
      return res;
    })
    .catch((err: unknown) => {
      // Log enriquecido de errores
      const e = err as { status?: number; message?: string; body?: unknown };
      const status = e?.status ?? 'UNKNOWN';
      const message = e?.message ?? 'HttpError';
      const body = e?.body;
      console.error('[HTTP ERROR]', { method, url, status, message, body });
      throw err;
    });
};

// Crear el dataProvider base para REST estándar
const baseDataProvider = simpleRestProvider(
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  httpClient
);

// Extender para operaciones específicas solamente
export const dataProvider: DataProvider = {
  ...baseDataProvider,
  
  // update personalizado para facturas: filtramos y normalizamos payload
  update: (resource, params) => {
    if (resource !== 'facturas') {
      return baseDataProvider.update(resource, params);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    type FacturaPayload = {
      numero?: string;
      punto_venta?: string;
      tipo_comprobante?: string;
      fecha_emision?: string;
      fecha_vencimiento?: string;
      subtotal?: number | string;
      total_impuestos?: number | string;
      total?: number | string;
      estado?: string;
      observaciones?: string;
      ruta_archivo_pdf?: string;
      nombre_archivo_pdf?: string;
      proveedor_id?: number | string;
      tipo_operacion_id?: number | string;
      usuario_responsable_id?: number | string;
      [k: string]: unknown;
    };

    const { id, data } = params as { id: number | string; data: FacturaPayload };

    // Campos permitidos por el backend
  const allowedKeys = new Set<string>([
      'numero',
      'punto_venta',
      'tipo_comprobante',
      'fecha_emision',
      'fecha_vencimiento',
      'subtotal',
      'total_impuestos',
      'total',
      'estado',
      'observaciones',
      'ruta_archivo_pdf',
      'nombre_archivo_pdf',
      'proveedor_id',
      'tipo_operacion_id',
      'usuario_responsable_id',
    ]);

  const pick = (obj: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(obj)
          .filter(([k, v]) => allowedKeys.has(k) && v !== undefined)
      );

  const payload = pick(data) as FacturaPayload;

    // Normalizaciones
  const toNumber = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };
  const toInt = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : undefined;
    };
  const toDateStr = (v: unknown): string | undefined => {
      if (!v) return undefined;
      const s = String(v);
      // Aceptar 'YYYY-MM-DD' o ISO; truncar a 10
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    if ('subtotal' in payload) payload.subtotal = toNumber(payload.subtotal);
    if ('total_impuestos' in payload) payload.total_impuestos = toNumber(payload.total_impuestos);
    if ('total' in payload) payload.total = toNumber(payload.total);
    if ('proveedor_id' in payload) payload.proveedor_id = toInt(payload.proveedor_id);
    if ('tipo_operacion_id' in payload) payload.tipo_operacion_id = toInt(payload.tipo_operacion_id);
    if ('usuario_responsable_id' in payload) payload.usuario_responsable_id = toInt(payload.usuario_responsable_id);
    if ('fecha_emision' in payload) payload.fecha_emision = toDateStr(payload.fecha_emision);
    if ('fecha_vencimiento' in payload) payload.fecha_vencimiento = toDateStr(payload.fecha_vencimiento);
    if ('numero' in payload && typeof payload.numero === 'string') payload.numero = payload.numero.trim();
    if ('punto_venta' in payload && typeof payload.punto_venta === 'string') payload.punto_venta = payload.punto_venta.trim();
    if (!('estado' in payload) || !payload.estado) payload.estado = 'pendiente';

    // Eliminar claves con undefined (para no sobreescribir con null/undefined)
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }

    console.log('🧹 PUT /facturas payload normalizado:', payload);

    return httpClient(`${apiUrl}/${resource}/${id}`, {
      method: 'PUT',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(async ({ json }) => {
      // Guardar JSON de la factura en la entidad histórica
      try {
        const facturaId = ((): number | undefined => {
          const j = json as unknown;
          if (j && typeof j === 'object' && 'id' in j) {
            const idVal = (j as Record<string, unknown>).id;
            return typeof idVal === 'number' ? idVal : undefined;
          }
          return undefined;
        })();
        const historyBody = {
          factura_id: facturaId,
          payload_json: JSON.stringify(json),
          metodo_extraccion: 'manual',
          estado: 'exitoso',
        } as Record<string, unknown>;

        await httpClient(`${apiUrl}/facturas-extracciones`, {
          method: 'POST',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(historyBody),
        });
      } catch (e) {
        console.warn('No se pudo registrar el JSON de la factura (update):', e);
      }
      return { data: json };
    });
  },
  
  // create personalizado para facturas: filtramos y normalizamos payload
  create: (resource, params) => {
    if (resource !== 'facturas') {
      return baseDataProvider.create(resource, params);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const { data } = params as { data: Record<string, unknown> };

    const allowedKeys = new Set<string>([
      'numero',
      'punto_venta',
      'tipo_comprobante',
      'fecha_emision',
      'fecha_vencimiento',
      'subtotal',
      'total_impuestos',
      'total',
      'estado',
      'observaciones',
      'ruta_archivo_pdf',
      'nombre_archivo_pdf',
      'proveedor_id',
      'tipo_operacion_id',
      'usuario_responsable_id',
    ]);

    const pick = (obj: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(obj)
          .filter(([k, v]) => allowedKeys.has(k) && v !== undefined)
      );

    const payload = pick(data) as Record<string, unknown>;

    const toNumber = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    };
    const toInt = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    const toDateStr = (v: unknown): string | undefined => {
      if (!v) return undefined;
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    if ('subtotal' in payload) payload.subtotal = toNumber(payload.subtotal);
    if ('total_impuestos' in payload) payload.total_impuestos = toNumber(payload.total_impuestos);
    if ('total' in payload) payload.total = toNumber(payload.total);
    if ('proveedor_id' in payload) payload.proveedor_id = toInt(payload.proveedor_id);
    if ('tipo_operacion_id' in payload) payload.tipo_operacion_id = toInt(payload.tipo_operacion_id);
    if ('usuario_responsable_id' in payload) payload.usuario_responsable_id = toInt(payload.usuario_responsable_id);
    if ('fecha_emision' in payload) payload.fecha_emision = toDateStr(payload.fecha_emision);
    if ('fecha_vencimiento' in payload) payload.fecha_vencimiento = toDateStr(payload.fecha_vencimiento);
    if ('numero' in payload && typeof payload.numero === 'string') payload.numero = (payload.numero as string).trim();
    if ('punto_venta' in payload && typeof payload.punto_venta === 'string') payload.punto_venta = (payload.punto_venta as string).trim();
    if (!('estado' in payload) || !payload.estado) payload.estado = 'pendiente';

    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }

    console.log('🧹 POST /facturas payload normalizado:', payload);

    return httpClient(`${apiUrl}/${resource}`, {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    }).then(async ({ json }) => {
      // Guardar JSON de la factura en la entidad histórica
      try {
        const facturaId = ((): number | undefined => {
          const j = json as unknown;
          if (j && typeof j === 'object' && 'id' in j) {
            const idVal = (j as Record<string, unknown>).id;
            return typeof idVal === 'number' ? idVal : undefined;
          }
          return undefined;
        })();
        const historyBody = {
          factura_id: facturaId,
          payload_json: JSON.stringify(json),
          metodo_extraccion: 'manual',
          estado: 'exitoso',
        } as Record<string, unknown>;

        await httpClient(`${apiUrl}/facturas-extracciones`, {
          method: 'POST',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(historyBody),
        });
      } catch (e) {
        console.warn('No se pudo registrar el JSON de la factura (create):', e);
      }
      return { data: json };
    });
  },
  
  // deleteMany siguiendo el patrón estándar
  deleteMany: (resource, params) => {
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const queryString = `filter=${encodeURIComponent(query.filter)}`;
    
    console.log('🔥 BULK DELETE Frontend - IDs a eliminar:', params.ids);
    console.log('🌐 DELETE URL:', `${apiUrl}/${resource}?${queryString}`);
    
    return httpClient(`${apiUrl}/${resource}?${queryString}`, {
      method: 'DELETE',
    }).then(({ json }) => {
      console.log('✅ DELETE Response del backend:', json);
      
      return { 
        data: params.ids  // Devolver SIEMPRE los IDs que se enviaron
      };
    });
  },
};

export default dataProvider;
