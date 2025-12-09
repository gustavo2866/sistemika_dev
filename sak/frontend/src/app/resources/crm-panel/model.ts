import type { CRMOportunidad, CRMOportunidadEstado } from "../crm-oportunidades/model";
import type { BucketKey } from "./oportunidad-helpers";

// Calcular bucket key basado en el estado de la oportunidad
export const calculateOportunidadBucketKey = (oportunidad: CRMOportunidad): BucketKey => {
  return oportunidad.estado;
};

// Preparar payload para mover oportunidad entre buckets
export const prepareMoveOportunidadPayload = (
  oportunidad: CRMOportunidad,
  targetBucket: BucketKey
): Partial<CRMOportunidad> => {
  return {
    estado: targetBucket,
    fecha_estado: new Date().toISOString(),
  };
};

// Obtener label del bucket
export const getBucketLabel = (bucketKey: BucketKey): string => {
  const labels: Record<BucketKey, string> = {
    "0-prospect": "Prospect",
    "1-abierta": "Abierta",
    "2-visita": "Visita",
    "3-cotiza": "Cotiza",
    "4-reserva": "Reserva",
    "5-ganada": "Ganada",
    "6-perdida": "Perdida",
  };
  return labels[bucketKey] || bucketKey;
};
