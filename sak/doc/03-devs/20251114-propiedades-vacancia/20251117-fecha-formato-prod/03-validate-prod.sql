-- Validaciones clave tras adecuar datos al formato DATE en producción.
-- Ejecutar contra producción (Neon) con la URL directa o pooled.

-- 1) Propiedades con fecha de estado faltante
SELECT COUNT(*) AS sin_estado_fecha
FROM propiedades
WHERE estado_fecha IS NULL AND deleted_at IS NULL;

-- 2) Vacancias huérfanas
SELECT COUNT(*) AS vacancias_huerfanas
FROM vacancias v
LEFT JOIN propiedades p ON v.propiedad_id = p.id
WHERE p.id IS NULL;

-- 3) Distribución de estados de propiedades
SELECT estado, COUNT(*) AS cantidad
FROM propiedades
WHERE deleted_at IS NULL
GROUP BY estado
ORDER BY estado;

-- 4) Orden cronológico de fechas en vacancias activas
SELECT id, propiedad_id,
       fecha_recibida,
       fecha_en_reparacion,
       fecha_disponible,
       fecha_alquilada,
       fecha_retirada
FROM vacancias
WHERE ciclo_activo = true
  AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 20;

-- 5) Últimos cambios para sanity check
SELECT id, nombre, estado, estado_fecha, updated_at
FROM propiedades
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 10;
