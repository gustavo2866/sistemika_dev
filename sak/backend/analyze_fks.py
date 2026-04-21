import re, glob

fk_pattern = re.compile(r'foreign_key\s*=\s*["\'](\w+)\.\w+["\']')
tablename_pattern = re.compile(r'__tablename__\s*=\s*["\'](\w+)["\']')

deps = {}
for path in glob.glob('app/models/**/*.py', recursive=True):
    content = open(path, encoding='utf-8').read()
    tables = tablename_pattern.findall(content)
    fks = fk_pattern.findall(content)
    for t in tables:
        if t not in deps:
            deps[t] = set()
        for fk in fks:
            if fk != t:
                deps[t].add(fk)

ops = {
    'webhook_logs','crm_mensajes','crm_oportunidad_log_estado','crm_eventos',
    'crm_oportunidades','crm_contactos','contratos_archivos','propiedades_servicios',
    'propiedades_log_status','contratos','propiedades','cotizacion_moneda',
    'comprobantes','factura_impuestos','factura_detalles','facturas',
    'po_orders_archivos','po_invoice_taxes','po_invoice_detalles','po_invoices',
    'po_order_status_log','po_order_details','po_orders','partes_diario_detalles',
    'partes_diario','proy_presupuestos','proyecto_avance','proyectos','nominas','tareas'
}

for t in sorted(ops):
    relevant = [(fk, 'OPS' if fk in ops else 'PARAM') for fk in deps.get(t, [])]
    print(f'{t} -> {relevant}')
