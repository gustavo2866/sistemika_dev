"""
Script de verificación de consistencia de base de datos CRM
"""
import sys
import os
from pathlib import Path

# Agregar backend al path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env")

from sqlmodel import Session, select
from app.db import engine
from app.models import *

def verificar_consistencia():
    session = Session(engine)
    
    print("\n" + "="*70)
    print("VERIFICACIÓN DE CONSISTENCIA - BASE DE DATOS CRM")
    print("="*70)
    
    # 1. Verificar integridad referencial de Oportunidades
    print("\n1️⃣ OPORTUNIDADES - Integridad Referencial:")
    oportunidades = session.exec(select(CRMOportunidad)).all()
    
    errores_opp = []
    for opp in oportunidades:
        if not opp.contacto:
            errores_opp.append(f"Oportunidad #{opp.id} sin contacto válido")
        if not opp.tipo_operacion:
            errores_opp.append(f"Oportunidad #{opp.id} sin tipo_operacion válido")
        if not opp.responsable:
            errores_opp.append(f"Oportunidad #{opp.id} sin responsable válido")
        if opp.propiedad_id and not opp.propiedad:
            errores_opp.append(f"Oportunidad #{opp.id} con propiedad_id inválido")
        if opp.moneda_id and not opp.moneda:
            errores_opp.append(f"Oportunidad #{opp.id} con moneda_id inválido")
    
    if errores_opp:
        print(f"   ❌ {len(errores_opp)} errores encontrados:")
        for err in errores_opp[:5]:  # Mostrar solo primeros 5
            print(f"      - {err}")
    else:
        print(f"   ✅ {len(oportunidades)} oportunidades - Todas las FKs válidas")
    
    # 2. Verificar integridad referencial de Eventos
    print("\n2️⃣ EVENTOS - Integridad Referencial:")
    eventos = session.exec(select(CRMEvento)).all()
    
    errores_evt = []
    for evt in eventos:
        if not evt.contacto:
            errores_evt.append(f"Evento #{evt.id} sin contacto válido")
        if not evt.tipo:
            errores_evt.append(f"Evento #{evt.id} sin tipo válido")
        if not evt.motivo:
            errores_evt.append(f"Evento #{evt.id} sin motivo válido")
        if evt.oportunidad_id and not evt.oportunidad:
            errores_evt.append(f"Evento #{evt.id} con oportunidad_id inválido")
    
    if errores_evt:
        print(f"   ❌ {len(errores_evt)} errores encontrados:")
        for err in errores_evt[:5]:
            print(f"      - {err}")
    else:
        print(f"   ✅ {len(eventos)} eventos - Todas las FKs válidas")
    
    # 3. Verificar Propiedades con emprendimientos
    print("\n3️⃣ PROPIEDADES - Consistencia con Emprendimientos:")
    propiedades = session.exec(select(Propiedad)).all()
    
    # Props con emprendimiento deben tener tipo_operacion = 3
    inconsistencias = []
    for prop in propiedades:
        if prop.emprendimiento_id and prop.tipo_operacion_id != 3:
            inconsistencias.append(
                f"Propiedad #{prop.id} tiene emprendimiento pero tipo_operacion != 3"
            )
    
    if inconsistencias:
        print(f"   ❌ {len(inconsistencias)} inconsistencias:")
        for inc in inconsistencias[:5]:
            print(f"      - {inc}")
    else:
        props_con_empr = sum(1 for p in propiedades if p.emprendimiento_id)
        print(f"   ✅ {props_con_empr} propiedades con emprendimiento - Todas consistentes")
    
    # 4. Verificar terrenos
    print("\n4️⃣ TERRENOS - Validación especial:")
    terrenos = [p for p in propiedades if p.tipo and 'terreno' in p.tipo.lower()]
    terrenos_sin_tipo_3 = [t for t in terrenos if t.tipo_operacion_id != 3]
    
    if terrenos_sin_tipo_3:
        print(f"   ⚠️ {len(terrenos_sin_tipo_3)} terrenos sin tipo_operacion = emprendimiento:")
        for t in terrenos_sin_tipo_3:
            print(f"      - Terreno #{t.id}: tipo_operacion_id = {t.tipo_operacion_id}")
    else:
        print(f"   ✅ {len(terrenos)} terrenos - Todos con tipo_operacion = emprendimiento")
    
    # 5. Verificar estados de oportunidades
    print("\n5️⃣ ESTADOS DE OPORTUNIDADES - Distribución:")
    estados = {}
    for opp in oportunidades:
        estados[opp.estado] = estados.get(opp.estado, 0) + 1
    
    for estado, count in sorted(estados.items()):
        print(f"   - {estado}: {count}")
    
    # 6. Verificar logs de oportunidades
    print("\n6️⃣ LOGS DE ESTADO - Consistencia:")
    logs = session.exec(select(CRMOportunidadLogEstado)).all()
    
    logs_huerfanos = []
    for log in logs:
        if not session.get(CRMOportunidad, log.oportunidad_id):
            logs_huerfanos.append(f"Log #{log.id} referencia oportunidad inexistente #{log.oportunidad_id}")
    
    if logs_huerfanos:
        print(f"   ❌ {len(logs_huerfanos)} logs huérfanos:")
        for lh in logs_huerfanos[:5]:
            print(f"      - {lh}")
    else:
        print(f"   ✅ {len(logs)} logs de estado - Todos válidos")
    
    # 7. Verificar contactos
    print("\n7️⃣ CONTACTOS - Validación:")
    contactos = session.exec(select(CRMContacto)).all()
    
    contactos_sin_contacto = []
    for c in contactos:
        tiene_email = c.email is not None and c.email.strip() != ""
        tiene_tel = c.telefonos and len(c.telefonos) > 0
        if not (tiene_email or tiene_tel):
            contactos_sin_contacto.append(f"Contacto #{c.id} ({c.nombre_completo}) sin email ni teléfono")
    
    if contactos_sin_contacto:
        print(f"   ⚠️ {len(contactos_sin_contacto)} contactos sin datos de contacto:")
        for csc in contactos_sin_contacto[:5]:
            print(f"      - {csc}")
    else:
        print(f"   ✅ {len(contactos)} contactos - Todos con email o teléfono")
    
    # Resumen final
    print("\n" + "="*70)
    total_errores = len(errores_opp) + len(errores_evt) + len(inconsistencias) + len(logs_huerfanos)
    total_warnings = len(terrenos_sin_tipo_3) + len(contactos_sin_contacto)
    
    if total_errores == 0 and total_warnings == 0:
        print("✅ BASE DE DATOS CONSISTENTE - Sin errores ni advertencias")
    elif total_errores == 0:
        print(f"⚠️ BASE DE DATOS FUNCIONAL - {total_warnings} advertencias (no críticas)")
    else:
        print(f"❌ BASE DE DATOS CON PROBLEMAS - {total_errores} errores, {total_warnings} advertencias")
    
    print("="*70)
    
    session.close()
    return total_errores == 0

if __name__ == "__main__":
    try:
        ok = verificar_consistencia()
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
