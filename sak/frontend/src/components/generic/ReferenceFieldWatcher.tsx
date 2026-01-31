/**
 * ReferenceFieldWatcher - Hook genérico para watch + fetch + validation
 * 
 * Unifica el patrón común de:
 * 1. Watch cambios en campo de referencia
 * 2. Fetch datos usando useGetOne cuando el valor es válido
 * 3. Manejo de estados loading/error/success
 * 4. Validación automática de existencia
 * 5. Cache de resultados
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import { useGetOne } from "ra-core";

// ============================================
// TYPES
// ============================================

interface UseReferenceFieldWatcherOptions<T = any> {
  enabled?: boolean;
  onDataLoad?: (data: T) => void;
  validation?: (data: T) => boolean;
  cacheResults?: boolean;
}

interface ReferenceFieldWatcherResult<T = any> {
  data: T | null;
  isLoading: boolean;
  error: any;
  isValid: boolean;
  referenceId: number | null;
}

// ============================================
// HOOK
// ============================================

export function useReferenceFieldWatcher<T = any>(
  fieldName: string,
  resource: string,
  options: UseReferenceFieldWatcherOptions<T> = {}
): ReferenceFieldWatcherResult<T> {
  const {
    enabled = true,
    onDataLoad,
    validation,
    cacheResults = true,
  } = options;

  // Cache simple para evitar re-fetch
  const cacheRef = useRef<Map<number, T>>(new Map());
  const lastValidIdRef = useRef<number | null>(null);

  // Watch del campo
  const watchedValue = useWatch({ name: fieldName });
  
  // Convertir y validar el ID
  const referenceId = useMemo(() => {
    const numValue = Number(watchedValue);
    return Number.isFinite(numValue) && numValue > 0 ? numValue : null;
  }, [watchedValue]);

  // Determinar si necesitamos fetch
  const shouldFetch = useMemo(() => {
    if (!enabled || !referenceId) return false;
    if (cacheResults && cacheRef.current.has(referenceId)) return false;
    return referenceId !== lastValidIdRef.current;
  }, [enabled, referenceId, cacheResults]);

  // Hook de fetch
  const { 
    data: fetchedData, 
    isLoading, 
    error 
  } = useGetOne(
    resource,
    { id: referenceId || 0 },
    { enabled: shouldFetch && !!referenceId }
  );

  // Obtener data final (cache o fetched)
  const finalData = useMemo(() => {
    if (!referenceId) return null;
    
    if (cacheResults && cacheRef.current.has(referenceId)) {
      return cacheRef.current.get(referenceId) || null;
    }
    
    return fetchedData || null;
  }, [referenceId, fetchedData, cacheResults]);

  // Validar data
  const isValid = useMemo(() => {
    if (!finalData) return false;
    return validation ? validation(finalData) : true;
  }, [finalData, validation]);

  // Efectos
  useEffect(() => {
    if (fetchedData && referenceId && !error) {
      // Actualizar cache
      if (cacheResults) {
        cacheRef.current.set(referenceId, fetchedData);
      }
      
      // Actualizar último ID válido
      lastValidIdRef.current = referenceId;
      
      // Callback de data load
      if (onDataLoad) {
        onDataLoad(fetchedData);
      }
    }
  }, [fetchedData, referenceId, error, onDataLoad, cacheResults]);

  // Limpiar cache cuando se desmonta o cambia resource
  useEffect(() => {
    const currentCache = cacheRef.current;
    return () => {
      if (cacheResults) {
        currentCache.clear();
      }
    };
  }, [resource, cacheResults]);

  return {
    data: finalData,
    isLoading: isLoading && shouldFetch,
    error,
    isValid,
    referenceId,
  };
}

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Hook específico para artículos con validación de genérico
 */
export function useArticuloWatcher(fieldName: string = "articulo_id") {
  return useReferenceFieldWatcher(fieldName, "articulos", {
    validation: (articulo) => !!articulo && typeof articulo === 'object',
    onDataLoad: (articulo) => {
      // Log para debugging si es necesario
      console.debug('Artículo loaded:', { 
        id: (articulo as any)?.id, 
        generico: (articulo as any)?.generico 
      });
    }
  });
}

/**
 * Hook específico para proveedores
 */
export function useProveedorWatcher(fieldName: string = "proveedor_id") {
  return useReferenceFieldWatcher(fieldName, "proveedores", {
    validation: (proveedor) => !!proveedor && typeof proveedor === 'object',
  });
}

/**
 * Hook específico para centros de costo
 */
export function useCentroCostoWatcher(fieldName: string = "centro_costo_id") {
  return useReferenceFieldWatcher(fieldName, "centros-costo", {
    validation: (centro) => !!centro && typeof centro === 'object',
  });
}
