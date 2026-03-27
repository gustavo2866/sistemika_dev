-- Vista optimizada para KPIs Dashboard Proyectos
-- Relaciona po_orders con proyectos usando fecha de emisión (estado=3)

CREATE OR REPLACE VIEW vw_kpis_proyectos_po_orders AS
SELECT 
    o.id as nro_orden,
    o.tipo_solicitud_id,
    p.id as proyecto_id,
    o.oportunidad_id,
    log_emision.fecha_registro as fecha_emision,
    os.nombre as estado,
    -- Mapeo de tipo_solicitud a concepto de proyecto
    CASE 
        WHEN o.tipo_solicitud_id = 7 THEN 'mo_propia'
        WHEN o.tipo_solicitud_id IN (3, 5, 6) THEN 'mo_terceros'  -- Servicios, Transporte, Mensajería
        WHEN o.tipo_solicitud_id IN (1, 2, 4) THEN 'materiales'   -- Materiales, Ferretería, Insumos
        ELSE 'otros'
    END as concepto_proyecto,
    o.total as importe
FROM po_orders o
-- Join con log para obtener fecha de emisión (estado = 3 'emitida')
INNER JOIN po_order_status_log log_emision 
    ON o.id = log_emision.order_id 
    AND log_emision.status_nuevo_id = 3  -- Estado 'emitida'
-- Join para obtener estado actual
INNER JOIN po_order_status os ON o.order_status_id = os.id
-- Join con proyectos a través de oportunidad_id  
INNER JOIN proyectos p ON o.oportunidad_id = p.oportunidad_id
WHERE 
    o.oportunidad_id IS NOT NULL
    AND p.oportunidad_id IS NOT NULL
    AND log_emision.fecha_registro IS NOT NULL;

-- Índices recomendados para performance:
-- CREATE INDEX idx_vw_kpis_proyectos_fecha_emision ON po_order_status_log (fecha_registro) WHERE status_nuevo_id = 3;
-- CREATE INDEX idx_vw_kpis_proyectos_oportunidad ON po_orders (oportunidad_id) WHERE oportunidad_id IS NOT NULL;