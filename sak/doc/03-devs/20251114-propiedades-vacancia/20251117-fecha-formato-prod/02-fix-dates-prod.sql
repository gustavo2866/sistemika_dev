-- Normalización de fechas después de aplicar la migración Alembic 2b6cc3ddf3d1.
-- Ejecutar en producción (Neon) para garantizar que las fechas queden en formato DATE sin perder integridad.

BEGIN;

-- Asegurar que estado_fecha no quede nulo y quede truncado a fecha
UPDATE propiedades
SET estado_fecha = COALESCE(estado_fecha::date, updated_at::date, created_at::date, CURRENT_DATE)
WHERE estado_fecha IS NULL;

-- Truncar componentes de hora en vacancias (por coherencia con el tipo DATE)
UPDATE vacancias
SET fecha_recibida      = fecha_recibida::date,
    fecha_en_reparacion = fecha_en_reparacion::date,
    fecha_disponible    = fecha_disponible::date,
    fecha_alquilada     = fecha_alquilada::date,
    fecha_retirada      = fecha_retirada::date
WHERE fecha_recibida IS NOT NULL
   OR fecha_en_reparacion IS NOT NULL
   OR fecha_disponible IS NOT NULL
   OR fecha_alquilada IS NOT NULL
   OR fecha_retirada IS NOT NULL;

-- Para vacancias activas sin fecha_recibida, rellenar con la fecha de creación
UPDATE vacancias
SET fecha_recibida = COALESCE(created_at::date, CURRENT_DATE)
WHERE ciclo_activo = true
  AND fecha_recibida IS NULL;

COMMIT;
