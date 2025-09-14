import { useState, useCallback } from 'react';
import { useNotify } from 'ra-core';

interface UploadProgress {
  loading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'extracting' | 'completed' | 'error';
  message?: string;
}

interface ExtractionResult {
  success: boolean;
  file_path: string;
  auto_extracted: boolean;
  data?: Record<string, unknown>;
  file_info?: Record<string, unknown>;
  template_data?: Record<string, unknown>;
  message?: string;
}

interface UseFacturaPDFExtractionOptions {
  onSuccess?: (result: ExtractionResult) => void;
  onError?: (error: Error) => void;
  autoExtract?: boolean;
}

export function useFacturaPDFExtraction(options: UseFacturaPDFExtractionOptions = {}) {
  const notify = useNotify();
  
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loading: false,
    progress: 0,
    status: 'idle'
  });

  const uploadAndExtract = useCallback(async (
    file: File,
    proveedorId: number,
    tipoOperacionId: number,
    autoExtract: boolean = options.autoExtract ?? false
  ) => {
    if (!file) {
      notify('Debe seleccionar un archivo PDF', { type: 'error' });
      return null;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      notify('Solo se permiten archivos PDF', { type: 'error' });
      return null;
    }

    setUploadProgress({
      loading: true,
      progress: 0,
      status: 'uploading',
      message: 'Subiendo archivo...'
    });

    try {
      // Crear FormData para el upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('proveedor_id', proveedorId.toString());
      formData.append('tipo_operacion_id', tipoOperacionId.toString());
      formData.append('auto_extract', autoExtract.toString());

      // Simular progreso de upload
      setUploadProgress(prev => ({ ...prev, progress: 30 }));

      // Hacer la llamada al endpoint de upload
      const response = await fetch('/api/facturas/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error en upload: ${response.statusText}`);
      }

      setUploadProgress(prev => ({ 
        ...prev, 
        progress: autoExtract ? 60 : 90,
        status: autoExtract ? 'extracting' : 'completed',
        message: autoExtract ? 'Extrayendo datos...' : 'Completando...'
      }));

      const result: ExtractionResult = await response.json();

      setUploadProgress(prev => ({ 
        ...prev, 
        progress: 100,
        status: 'completed',
        message: 'Proceso completado exitosamente'
      }));

      // Notificar éxito
      if (result.success) {
        notify(
          autoExtract 
            ? 'PDF procesado y datos extraídos exitosamente' 
            : 'PDF subido exitosamente',
          { type: 'success' }
        );
        
        // Llamar callback de éxito
        options.onSuccess?.(result);
      } else {
        throw new Error(result.message || 'Error en el procesamiento');
      }

      return result;

    } catch (error) {
      setUploadProgress(prev => ({ 
        ...prev, 
        loading: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }));

      notify(
        `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        { type: 'error' }
      );

      // Llamar callback de error
      options.onError?.(error instanceof Error ? error : new Error('Error desconocido'));
      
      return null;

    } finally {
      // Limpiar progreso después de 3 segundos
      setTimeout(() => {
        setUploadProgress({
          loading: false,
          progress: 0,
          status: 'idle'
        });
      }, 3000);
    }
  }, [notify, options]);

  const extractFromExistingFile = useCallback(async (
    filePath: string,
    proveedorId: number,
    tipoOperacionId: number
  ) => {
    setUploadProgress({
      loading: true,
      progress: 0,
      status: 'extracting',
      message: 'Extrayendo datos del archivo existente...'
    });

    try {
      const formData = new FormData();
      formData.append('file_path', filePath);
      formData.append('proveedor_id', proveedorId.toString());
      formData.append('tipo_operacion_id', tipoOperacionId.toString());

      setUploadProgress(prev => ({ ...prev, progress: 50 }));

      const response = await fetch('/api/facturas/extract-from-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error en extracción: ${response.statusText}`);
      }

      const result: ExtractionResult = await response.json();

      setUploadProgress(prev => ({ 
        ...prev, 
        progress: 100,
        status: 'completed',
        message: 'Extracción completada exitosamente'
      }));

      if (result.success) {
        notify('Datos extraídos exitosamente', { type: 'success' });
        options.onSuccess?.(result);
      } else {
        throw new Error(result.message || 'Error en la extracción');
      }

      return result;

    } catch (error) {
      setUploadProgress(prev => ({ 
        ...prev, 
        loading: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }));

      notify(
        `Error en extracción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        { type: 'error' }
      );

      options.onError?.(error instanceof Error ? error : new Error('Error desconocido'));
      return null;
    }
  }, [notify, options]);

  const getSupportedTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/facturas/supported-types');
      if (!response.ok) {
        throw new Error('Error obteniendo tipos soportados');
      }
      return await response.json();
    } catch {
      notify('Error obteniendo tipos de archivo soportados', { type: 'error' });
      return { supported_types: ['.pdf'], max_size_mb: 10 };
    }
  }, [notify]);

  const resetProgress = useCallback(() => {
    setUploadProgress({
      loading: false,
      progress: 0,
      status: 'idle'
    });
  }, []);

  return {
    uploadProgress,
    uploadAndExtract,
    extractFromExistingFile,
    getSupportedTypes,
    resetProgress,
    isLoading: uploadProgress.loading,
    isUploading: uploadProgress.status === 'uploading',
    isExtracting: uploadProgress.status === 'extracting',
    isCompleted: uploadProgress.status === 'completed',
    hasError: uploadProgress.status === 'error'
  };
}
