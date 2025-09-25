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

  // Inyectar Authorization si hay token (genérico, sin lógica por entidad)
  const effectiveHeaders = headers instanceof Headers ? headers : new Headers(headers || {});
  try {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token && !effectiveHeaders.has('Authorization')) {
        effectiveHeaders.set('Authorization', `Bearer ${token}`);
      }
    }
  } catch {
    // ignore storage access errors (SSR o sandbox)
  }
  options.headers = effectiveHeaders;

  let bodyLog: unknown = undefined;
  if (options?.body !== undefined) {
    // Intentar loguear el body de forma segura
    const b: unknown = options.body as unknown;
    if (typeof b === 'string') {
      bodyLog = (() => {
        try {
          return JSON.parse(b);
        } catch {
          return b;
        }
      })();
    } else if (typeof FormData !== 'undefined' && b instanceof FormData) {
      // No imprimimos binarios, solo las claves presentes
      const entries: Record<string, unknown> = {};
      b.forEach((value, key) => {
        if (value instanceof File) {
          entries[key] = { fileName: value.name, size: value.size, type: value.type };
        } else {
          entries[key] = value;
        }
      });
      bodyLog = { formData: entries };
    } else if (typeof b === 'object' && b !== null) {
      // Algunos runtimes podrían pasar un objeto ya construido (no estándar)
      try {
        bodyLog = JSON.parse(JSON.stringify(b));
      } catch {
        bodyLog = b;
      }
    } else {
      bodyLog = b;
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
      // Log enriquecido de errores (resiliente a distintos tipos de error)
      const e = err as { status?: number; message?: string; body?: unknown; name?: string; stack?: string } | unknown;
      const status = (typeof e === 'object' && e && 'status' in e) ? (e as { status?: number }).status ?? 'UNKNOWN' : 'UNKNOWN';
      const message = (typeof e === 'object' && e && 'message' in e)
        ? (e as { message?: string }).message ?? 'HttpError'
        : 'HttpError';
      const body = (typeof e === 'object' && e && 'body' in e)
        ? (e as { body?: unknown }).body
        : undefined;
      let bodyPreview: string | undefined;
      try {
        if (typeof body === 'string') {
          bodyPreview = body.slice(0, 2000);
        } else if (body !== undefined) {
          bodyPreview = JSON.stringify(body).slice(0, 2000);
        }
      } catch {}

      // Incluir detalles en el string para evitar que el overlay o consola los oculte
      console.error(`[HTTP ERROR] ${method} ${url} :: status=${status} message=${message}`);
      // Imprimir detalles adicionales y el error crudo
      console.error('[HTTP ERROR DETAILS]', { method, url, status, message, bodyPreview });
      console.error('[HTTP ERROR RAW]', err);
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
  // deleteMany fallback: ejecuta DELETE por ID porque el backend no acepta DELETE /resource?filter=...
  deleteMany: async (resource, params) => {
    const ids = params.ids;
    console.log('🔥 BULK DELETE (per-id fallback) - IDs a eliminar:', ids);

    const results = await Promise.allSettled(
      ids.map((id) => baseDataProvider.delete(resource, { id }))
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length) {
      const reason = rejected[0]?.reason ?? new Error('Fallo una o más eliminaciones');
      console.error('❌ BULK DELETE error en al menos una eliminación', { reason, results });
      throw reason;
    }

    console.log('✅ BULK DELETE completado', { ids });
    return { data: ids };
  },
};

export default dataProvider;
