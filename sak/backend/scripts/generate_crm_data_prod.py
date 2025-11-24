"""
Generar datos CRM de prueba en producción (Neon)
Crea contactos, oportunidades y eventos consistentes con las propiedades existentes
"""
import subprocess
from datetime import datetime, timedelta, date
from decimal import Decimal
import random
import json
from sqlalchemy import create_engine, text
from sqlmodel import Session, select

def get_production_database_url():
    """Obtener DATABASE_URL de producción"""
    try:
        result = subprocess.run(
            ["powershell", "-Command", 
             "gcloud secrets versions access latest --secret=DATABASE_URL --project=sak-wcl"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al obtener DATABASE_URL: {e}")
        return None

def get_existing_data(prod_engine):
    """Obtener datos existentes de catálogos y propiedades"""
    print("\n" + "="*70)
    print("OBTENIENDO DATOS EXISTENTES")
    print("="*70)
    
    data = {}
    
    with prod_engine.connect() as conn:
        # Propiedades
        result = conn.execute(text("SELECT id, nombre, tipo, estado, valor_alquiler, precio_venta_estimado FROM propiedades WHERE deleted_at IS NULL LIMIT 20"))
        data['propiedades'] = [dict(row._mapping) for row in result]
        print(f"✅ Propiedades: {len(data['propiedades'])} disponibles")
        
        # Usuarios
        result = conn.execute(text("SELECT id, email FROM users WHERE deleted_at IS NULL"))
        data['usuarios'] = [dict(row._mapping) for row in result]
        print(f"✅ Usuarios: {len(data['usuarios'])} disponibles")
        
        # Tipos de operación
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_tipos_operacion"))
        data['tipos_operacion'] = [dict(row._mapping) for row in result]
        print(f"✅ Tipos de operación: {len(data['tipos_operacion'])}")
        
        # Orígenes de lead
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_origenes_lead"))
        data['origenes_lead'] = [dict(row._mapping) for row in result]
        print(f"✅ Orígenes de lead: {len(data['origenes_lead'])}")
        
        # Tipos de evento
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_tipos_evento"))
        data['tipos_evento'] = [dict(row._mapping) for row in result]
        print(f"✅ Tipos de evento: {len(data['tipos_evento'])}")
        
        # Motivos de evento
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_motivos_evento"))
        data['motivos_evento'] = [dict(row._mapping) for row in result]
        print(f"✅ Motivos de evento: {len(data['motivos_evento'])}")
        
        # Monedas
        result = conn.execute(text("SELECT id, codigo, simbolo FROM monedas"))
        data['monedas'] = [dict(row._mapping) for row in result]
        print(f"✅ Monedas: {len(data['monedas'])}")
        
        # Motivos de pérdida
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_motivos_perdida"))
        data['motivos_perdida'] = [dict(row._mapping) for row in result]
        print(f"✅ Motivos de pérdida: {len(data['motivos_perdida'])}")
        
        # Condiciones de pago
        result = conn.execute(text("SELECT id, codigo, nombre FROM crm_condiciones_pago"))
        data['condiciones_pago'] = [dict(row._mapping) for row in result]
        print(f"✅ Condiciones de pago: {len(data['condiciones_pago'])}")
    
    return data

def generar_contactos(prod_engine, data, cantidad=30):
    """Generar contactos de prueba"""
    print("\n" + "="*70)
    print(f"GENERANDO {cantidad} CONTACTOS")
    print("="*70)
    
    nombres = [
        "Juan Pérez", "María García", "Carlos López", "Ana Martínez", "Luis Rodríguez",
        "Laura Fernández", "Diego González", "Sofía Sánchez", "Javier Romero", "Valentina Torres",
        "Miguel Ángel Ruiz", "Camila Díaz", "Andrés Morales", "Paula Jiménez", "Fernando Castro",
        "Gabriela Vargas", "Roberto Ortiz", "Lucía Mendoza", "Daniel Silva", "Carolina Herrera",
        "Martín Gutiérrez", "Natalia Rojas", "Pablo Navarro", "Victoria Campos", "Sebastián Ramos",
        "Isabella Flores", "Lucas Medina", "Emilia Vega", "Mateo Reyes", "Catalina Cruz"
    ]
    
    dominios = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "empresa.com"]
    
    contactos_ids = []
    usuario_id = data['usuarios'][0]['id'] if data['usuarios'] else 1
    
    with prod_engine.connect() as conn:
        for i in range(cantidad):
            nombre = random.choice(nombres) + f" {i+1}" if i >= len(nombres) else nombres[i]
            email = nombre.lower().replace(" ", ".") + "@" + random.choice(dominios)
            telefonos = [f"11-{random.randint(2000,6999)}-{random.randint(1000,9999)}"]
            origen_lead_id = random.choice(data['origenes_lead'])['id']
            
            # Insertar contacto
            import json
            telefonos_json = json.dumps(telefonos)
            
            result = conn.execute(
                text("""
                    INSERT INTO crm_contactos 
                    (nombre_completo, email, telefonos, origen_lead_id, responsable_id, created_at, updated_at, version)
                    VALUES (:nombre, :email, CAST(:telefonos AS jsonb), :origen_lead_id, :responsable_id, :created_at, :updated_at, 1)
                    RETURNING id
                """),
                {
                    'nombre': nombre,
                    'email': email,
                    'telefonos': telefonos_json,
                    'origen_lead_id': origen_lead_id,
                    'responsable_id': usuario_id,
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
            )
            contacto_id = result.fetchone()[0]
            contactos_ids.append(contacto_id)
        
        conn.commit()
    
    print(f"✅ {len(contactos_ids)} contactos creados")
    return contactos_ids

def generar_oportunidades(prod_engine, data, contactos_ids, cantidad=50):
    """Generar oportunidades de prueba"""
    print("\n" + "="*70)
    print(f"GENERANDO {cantidad} OPORTUNIDADES")
    print("="*70)
    
    estados = ['1-abierta', '2-contacto_inicial', '3-visita_programada', '4-propuesta_enviada', 
               '5-negociacion', '6-ganada', '7-perdida']
    
    usuario_id = data['usuarios'][0]['id'] if data['usuarios'] else 1
    moneda_usd = next((m['id'] for m in data['monedas'] if m['codigo'] == 'USD'), data['monedas'][0]['id'])
    
    oportunidades_ids = []
    insertadas = 0
    
    with prod_engine.connect() as conn:
        for i in range(cantidad):
            contacto_id = random.choice(contactos_ids)
            tipo_operacion = random.choice(data['tipos_operacion'])
            propiedad = random.choice(data['propiedades'])
            estado = random.choice(estados)
            
            # Fecha entre 30 días atrás y hoy
            dias_atras = random.randint(0, 30)
            fecha_estado = datetime.now() - timedelta(days=dias_atras)
            
            # Monto basado en el precio de la propiedad (si existe)
            monto_base = propiedad.get('precio_venta_estimado') or propiedad.get('valor_alquiler') or 100000
            monto = Decimal(monto_base) * Decimal(random.uniform(0.9, 1.1))
            
            # Probabilidad según estado
            probabilidades = {
                '1-abierta': 20,
                '2-contacto_inicial': 30,
                '3-visita_programada': 50,
                '4-propuesta_enviada': 70,
                '5-negociacion': 85,
                '6-ganada': 100,
                '7-perdida': 0
            }
            probabilidad = probabilidades.get(estado, 50)
            
            # Fecha estimada de cierre (15-45 días desde ahora)
            if estado not in ['6-ganada', '7-perdida']:
                fecha_cierre_estimada = date.today() + timedelta(days=random.randint(15, 45))
            else:
                fecha_cierre_estimada = None
            
            # Motivo de pérdida si está perdida
            motivo_perdida_id = random.choice(data['motivos_perdida'])['id'] if estado == '7-perdida' else None
            
            # Condición de pago
            condicion_pago_id = random.choice(data['condiciones_pago'])['id']
            
            try:
                result = conn.execute(
                    text("""
                        INSERT INTO crm_oportunidades 
                        (contacto_id, tipo_operacion_id, propiedad_id, estado, fecha_estado,
                         monto, moneda_id, probabilidad, fecha_cierre_estimada, responsable_id,
                         condicion_pago_id, motivo_perdida_id, created_at, updated_at, version)
                        VALUES (:contacto_id, :tipo_operacion_id, :propiedad_id, :estado, :fecha_estado,
                                :monto, :moneda_id, :probabilidad, :fecha_cierre_estimada, :responsable_id,
                                :condicion_pago_id, :motivo_perdida_id, :created_at, :updated_at, 1)
                        RETURNING id
                    """),
                    {
                        'contacto_id': contacto_id,
                        'tipo_operacion_id': tipo_operacion['id'],
                        'propiedad_id': propiedad['id'],
                        'estado': estado,
                        'fecha_estado': fecha_estado,
                        'monto': float(monto),
                        'moneda_id': moneda_usd,
                        'probabilidad': probabilidad,
                        'fecha_cierre_estimada': fecha_cierre_estimada,
                        'responsable_id': usuario_id,
                        'condicion_pago_id': condicion_pago_id,
                        'motivo_perdida_id': motivo_perdida_id,
                        'created_at': fecha_estado,
                        'updated_at': datetime.now()
                    }
                )
                oportunidad_id = result.fetchone()[0]
                oportunidades_ids.append({
                    'id': oportunidad_id,
                    'contacto_id': contacto_id,
                    'fecha_estado': fecha_estado
                })
                insertadas += 1
            except Exception as e:
                print(f"  ⚠️  Error insertando oportunidad: {e}")
                continue
        
        conn.commit()
    
    print(f"✅ {insertadas} oportunidades creadas")
    return oportunidades_ids

def generar_eventos(prod_engine, data, contactos_ids, oportunidades, cantidad=100):
    """Generar eventos de prueba"""
    print("\n" + "="*70)
    print(f"GENERANDO {cantidad} EVENTOS")
    print("="*70)
    
    descripciones_base = [
        "Cliente consultó por la propiedad",
        "Visita programada a la propiedad",
        "Seguimiento telefónico con el cliente",
        "Envío de documentación solicitada",
        "Reunión para negociar términos",
        "Cliente solicitó más información",
        "Presentación de propuesta formal",
        "Coordinación de visita con dueño",
        "Revisión de condiciones de pago",
        "Cliente mostró interés en la zona"
    ]
    
    estados_evento = ['pendiente', 'hecho', 'cancelado']
    usuario_id = data['usuarios'][0]['id'] if data['usuarios'] else 1
    
    insertados = 0
    
    with prod_engine.connect() as conn:
        for i in range(cantidad):
            contacto_id = random.choice(contactos_ids)
            tipo_evento = random.choice(data['tipos_evento'])
            motivo_evento = random.choice(data['motivos_evento'])
            
            # 70% de eventos tienen oportunidad asociada
            oportunidad = random.choice(oportunidades) if random.random() < 0.7 and oportunidades else None
            oportunidad_id = oportunidad['id'] if oportunidad else None
            
            # Fecha del evento
            if oportunidad:
                # Evento cercano a la fecha de la oportunidad
                dias_desde_opor = random.randint(-5, 10)
                fecha_evento = oportunidad['fecha_estado'] + timedelta(days=dias_desde_opor)
            else:
                dias_atras = random.randint(0, 30)
                fecha_evento = datetime.now() - timedelta(days=dias_atras)
            
            # Estado del evento
            if fecha_evento < datetime.now() - timedelta(days=1):
                estado_evento = random.choice(['hecho', 'cancelado'])
            else:
                estado_evento = 'pendiente'
            
            descripcion = random.choice(descripciones_base) + f" - Evento #{i+1}"
            
            # Próximo paso si está pendiente
            proximo_paso = None
            fecha_compromiso = None
            if estado_evento == 'pendiente':
                proximo_paso = "Confirmar asistencia" if random.random() < 0.5 else "Enviar recordatorio"
                fecha_compromiso = date.today() + timedelta(days=random.randint(1, 7))
            
            try:
                conn.execute(
                    text("""
                        INSERT INTO crm_eventos 
                        (contacto_id, tipo_id, motivo_id, fecha_evento, descripcion,
                         asignado_a_id, oportunidad_id, estado_evento, proximo_paso,
                         fecha_compromiso, created_at, updated_at, version)
                        VALUES (:contacto_id, :tipo_id, :motivo_id, :fecha_evento, :descripcion,
                                :asignado_a_id, :oportunidad_id, :estado_evento, :proximo_paso,
                                :fecha_compromiso, :created_at, :updated_at, 1)
                    """),
                    {
                        'contacto_id': contacto_id,
                        'tipo_id': tipo_evento['id'],
                        'motivo_id': motivo_evento['id'],
                        'fecha_evento': fecha_evento,
                        'descripcion': descripcion,
                        'asignado_a_id': usuario_id,
                        'oportunidad_id': oportunidad_id,
                        'estado_evento': estado_evento,
                        'proximo_paso': proximo_paso,
                        'fecha_compromiso': fecha_compromiso,
                        'created_at': fecha_evento,
                        'updated_at': datetime.now()
                    }
                )
                insertados += 1
            except Exception as e:
                print(f"  ⚠️  Error insertando evento: {e}")
                continue
        
        conn.commit()
    
    print(f"✅ {insertados} eventos creados")

def main():
    print("="*70)
    print("GENERAR DATOS CRM EN PRODUCCIÓN")
    print("="*70)
    print("\n⚠️  Este script generará:")
    print("  - 30 contactos de prueba")
    print("  - 50 oportunidades vinculadas a propiedades existentes")
    print("  - 100 eventos relacionados con contactos y oportunidades")
    
    respuesta = input("\n¿Continuar? (s/n): ")
    if respuesta.lower() != 's':
        print("❌ Operación cancelada")
        return
    
    # Obtener DATABASE_URL de producción
    prod_db_url = get_production_database_url()
    if not prod_db_url:
        print("❌ No se pudo obtener la URL de producción")
        return
    
    prod_engine = create_engine(prod_db_url)
    
    try:
        # 1. Obtener datos existentes
        data = get_existing_data(prod_engine)
        
        if not data['propiedades']:
            print("\n❌ No hay propiedades en producción. Abortando.")
            return
        
        if not data['usuarios']:
            print("\n❌ No hay usuarios en producción. Abortando.")
            return
        
        # 2. Generar contactos
        contactos_ids = generar_contactos(prod_engine, data, cantidad=30)
        
        # 3. Generar oportunidades
        oportunidades = generar_oportunidades(prod_engine, data, contactos_ids, cantidad=50)
        
        # 4. Generar eventos
        generar_eventos(prod_engine, data, contactos_ids, oportunidades, cantidad=100)
        
        print("\n" + "="*70)
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
        print("="*70)
        print(f"\n  📊 Resumen:")
        print(f"     - Contactos: {len(contactos_ids)}")
        print(f"     - Oportunidades: {len(oportunidades)}")
        print(f"     - Eventos: 100 (aproximadamente)")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
