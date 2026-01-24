#!/usr/bin/env python3
"""
Script para probar la funcionalidad de actualización automática de ultimo_mensaje.

Simula la creación de mensajes y verifica que se actualicen correctamente
los campos ultimo_mensaje_id y ultimo_mensaje_at en las oportunidades.
"""

from sqlmodel import Session, select
from app.db import get_session
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.models.crm.mensaje import CRMMensaje
from app.models.crm.oportunidad import CRMOportunidad
from datetime import datetime, UTC


def test_crear_mensaje_actualiza_oportunidad():
    """Test: Crear un mensaje debe actualizar ultimo_mensaje en la oportunidad."""
    print("🧪 Test 1: Crear mensaje debe actualizar ultimo_mensaje...")
    
    with next(get_session()) as session:
        # Buscar una oportunidad que ya tenga mensajes
        oportunidad = session.exec(
            select(CRMOportunidad)
            .where(CRMOportunidad.ultimo_mensaje_id.is_not(None))
            .limit(1)
        ).first()
        
        if not oportunidad:
            print("❌ No hay oportunidades con mensajes para probar")
            return False
        
        print(f"📊 Oportunidad {oportunidad.id}: "
              f"ultimo_mensaje_id={oportunidad.ultimo_mensaje_id}, "
              f"ultimo_mensaje_at={oportunidad.ultimo_mensaje_at}")
        
        # Guardar estado inicial
        ultimo_mensaje_id_inicial = oportunidad.ultimo_mensaje_id
        ultimo_mensaje_at_inicial = oportunidad.ultimo_mensaje_at
        
        # Crear un nuevo mensaje más reciente
        nuevo_mensaje_data = {
            "tipo": "entrada",
            "canal": "whatsapp", 
            "oportunidad_id": oportunidad.id,
            "contacto_referencia": "+5491123456789",
            "contenido": "Mensaje de prueba automática",
            "fecha_mensaje": datetime.now(UTC),
            "estado": "nuevo"
        }
        
        # Crear mensaje usando el CRUD extendido
        nuevo_mensaje = crm_mensaje_crud.create(session, nuevo_mensaje_data)
        print(f"✅ Mensaje creado: {nuevo_mensaje.id} con fecha {nuevo_mensaje.fecha_mensaje}")
        
        # Refrescar oportunidad y verificar cambios
        session.refresh(oportunidad)
        
        print(f"📊 Oportunidad {oportunidad.id} actualizada: "
              f"ultimo_mensaje_id={oportunidad.ultimo_mensaje_id}, "
              f"ultimo_mensaje_at={oportunidad.ultimo_mensaje_at}")
        
        # Verificar que se actualizó
        if oportunidad.ultimo_mensaje_id == nuevo_mensaje.id:
            print("✅ Test 1 PASÓ: ultimo_mensaje_id se actualizó correctamente")
            return True
        else:
            print("❌ Test 1 FALLÓ: ultimo_mensaje_id no se actualizó")
            return False


def test_mensaje_mas_antiguo_no_actualiza():
    """Test: Un mensaje más antiguo no debe actualizar ultimo_mensaje."""
    print("\n🧪 Test 2: Mensaje más antiguo no debe actualizar ultimo_mensaje...")
    
    with next(get_session()) as session:
        # Buscar una oportunidad que ya tenga mensajes
        oportunidad = session.exec(
            select(CRMOportunidad)
            .where(CRMOportunidad.ultimo_mensaje_id.is_not(None))
            .limit(1)
        ).first()
        
        if not oportunidad:
            print("❌ No hay oportunidades con mensajes para probar")
            return False
        
        # Guardar estado inicial
        ultimo_mensaje_id_inicial = oportunidad.ultimo_mensaje_id
        ultimo_mensaje_at_inicial = oportunidad.ultimo_mensaje_at
        
        print(f"📊 Oportunidad {oportunidad.id}: "
              f"ultimo_mensaje_id={ultimo_mensaje_id_inicial}, "
              f"ultimo_mensaje_at={ultimo_mensaje_at_inicial}")
        
        # Crear un mensaje con fecha más antigua
        from datetime import timedelta
        fecha_antigua = ultimo_mensaje_at_inicial - timedelta(days=1)
        
        mensaje_antiguo_data = {
            "tipo": "entrada",
            "canal": "whatsapp",
            "oportunidad_id": oportunidad.id, 
            "contacto_referencia": "+5491123456789",
            "contenido": "Mensaje antiguo de prueba",
            "fecha_mensaje": fecha_antigua,
            "estado": "nuevo"
        }
        
        # Crear mensaje usando el CRUD
        mensaje_antiguo = crm_mensaje_crud.create(session, mensaje_antiguo_data)
        print(f"✅ Mensaje antiguo creado: {mensaje_antiguo.id} con fecha {mensaje_antiguo.fecha_mensaje}")
        
        # Refrescar oportunidad
        session.refresh(oportunidad)
        
        print(f"📊 Oportunidad {oportunidad.id} después: "
              f"ultimo_mensaje_id={oportunidad.ultimo_mensaje_id}, "
              f"ultimo_mensaje_at={oportunidad.ultimo_mensaje_at}")
        
        # Verificar que NO se actualizó
        if oportunidad.ultimo_mensaje_id == ultimo_mensaje_id_inicial:
            print("✅ Test 2 PASÓ: Mensaje antiguo no actualizó ultimo_mensaje")
            return True
        else:
            print("❌ Test 2 FALLÓ: Mensaje antiguo actualizó ultimo_mensaje incorrectamente")
            return False


def main():
    """Ejecutar todos los tests."""
    print("🚀 Iniciando tests de funcionalidad ultimo_mensaje...\n")
    
    tests_passed = 0
    total_tests = 2
    
    # Test 1
    if test_crear_mensaje_actualiza_oportunidad():
        tests_passed += 1
    
    # Test 2  
    if test_mensaje_mas_antiguo_no_actualiza():
        tests_passed += 1
    
    # Resumen
    print(f"\n📊 RESUMEN DE TESTS:")
    print(f"✅ Tests pasados: {tests_passed}/{total_tests}")
    print(f"❌ Tests fallidos: {total_tests - tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("🎉 ¡Todos los tests pasaron! La funcionalidad está trabajando correctamente.")
    else:
        print("⚠️  Algunos tests fallaron. Revisar la implementación.")


if __name__ == "__main__":
    main()