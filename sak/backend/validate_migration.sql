-- Script SQL para validar la migración
-- Ejecutar desde psql o cualquier cliente PostgreSQL

-- Ver todas las propiedades con estado 'realizada'
SELECT id, nombre, tipo, estado, estado_fecha, estado_comentario
FROM propiedades
WHERE estado = '4-realizada'
ORDER BY id;

-- Verificar que no queden propiedades con el estado antiguo
SELECT COUNT(*) as propiedades_antiguo_estado
FROM propiedades
WHERE estado = '4-alquilada';

-- Contar propiedades por estado
SELECT estado, COUNT(*) as cantidad
FROM propiedades
GROUP BY estado
ORDER BY estado;
