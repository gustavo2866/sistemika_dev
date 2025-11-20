"""
Script para verificar y completar información de oportunidades
1. Completar campos faltantes en oportunidades
2. Verificar consistencia con propiedades
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from sqlmodel import Session, select
from app.db import engine
from app.models import CRMOportunidad, Propiedad, CRMTipoOperacion
from datetime import datetime, UTC
from decimal import Decimal

def analizar_oportunidades():
    """Analizar estado de oportunidades"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("ANÁLISIS DE OPORTUNIDADES")
    print("="*80 + "\n")
    
    oportunidades = session.exec(select(CRMOportunidad)).all()
    print(f"Total oportunidades: {len(oportunidades)}\n")
    
    print("Estado actual de cada oportunidad:")
    print("-" * 80)
    
    for opp in oportunidades:
        propiedad = session.get(Propiedad, opp.propiedad_id) if opp.propiedad_id else None
        tipo_op = session.get(CRMTipoOperacion, opp.tipo_operacion_id) if opp.tipo_operacion_id else None
        
        print(f"\n📋 Oportunidad ID {opp.id}:")
        print(f"   Contacto ID: {opp.contacto_id}")
        print(f"   Propiedad ID: {opp.propiedad_id} - {propiedad.nombre if propiedad else 'N/A'}")
        print(f"   Tipo Operación: {tipo_op.nombre if tipo_op else 'N/A'}")
        print(f"   Estado Oportunidad: {opp.estado}")
        print(f"   Estado Propiedad: {propiedad.estado if propiedad else 'N/A'}")
        print(f"   Fecha Estado: {opp.fecha_estado}")
        print(f"   Monto: {opp.monto}")
        print(f"   Moneda ID: {opp.moneda_id}")
        print(f"   Condición Pago ID: {opp.condicion_pago_id}")
        print(f"   Probabilidad: {opp.probabilidad}")
        print(f"   Fecha Cierre Estimada: {opp.fecha_cierre_estimada}")
        print(f"   Descripción: {opp.descripcion_estado}")
        
        # Verificar consistencia
        inconsistencias = []
        
        if propiedad:
            # Verificar estado vs propiedad
            if opp.estado == "5-ganada" and propiedad.estado != "4-alquilada":
                inconsistencias.append("❌ Oportunidad ganada pero propiedad no está alquilada")
            
            # Verificar tipo de operación
            if opp.tipo_operacion_id != propiedad.tipo_operacion_id:
                inconsistencias.append(f"⚠️  Tipo operación no coincide: Opp={tipo_op.nombre if tipo_op else 'N/A'}, Prop={propiedad.tipo_operacion_id}")
        
        # Verificar campos requeridos según estado
        if opp.estado in ["5-ganada", "4-reserva"]:
            if not opp.monto:
                inconsistencias.append("❌ Falta monto para estado Ganada/Reserva")
            if not opp.condicion_pago_id:
                inconsistencias.append("❌ Falta condición de pago para estado Ganada/Reserva")
        
        if opp.estado == "6-perdida":
            if not opp.motivo_perdida_id:
                inconsistencias.append("❌ Falta motivo de pérdida")
        
        # Campos opcionales faltantes
        if not opp.probabilidad:
            inconsistencias.append("⚠️  Falta probabilidad")
        if not opp.fecha_cierre_estimada:
            inconsistencias.append("⚠️  Falta fecha cierre estimada")
        if not opp.descripcion_estado:
            inconsistencias.append("⚠️  Falta descripción de estado")
        
        if inconsistencias:
            print(f"   \n   🔍 Inconsistencias detectadas:")
            for inc in inconsistencias:
                print(f"      {inc}")
        else:
            print(f"   ✅ Sin inconsistencias")
    
    session.close()
    
    return oportunidades

def completar_campos_faltantes():
    """Completar campos faltantes en oportunidades"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("COMPLETANDO CAMPOS FALTANTES")
    print("="*80 + "\n")
    
    oportunidades = session.exec(select(CRMOportunidad)).all()
    actualizadas = 0
    
    for opp in oportunidades:
        cambios = []
        
        # Completar fecha_estado si falta
        if not opp.fecha_estado:
            opp.fecha_estado = opp.created_at if opp.created_at else datetime.now(UTC)
            cambios.append("fecha_estado")
        
        # Completar probabilidad según estado
        if not opp.probabilidad:
            probabilidades = {
                "1-abierta": 10,
                "2-visita": 30,
                "3-cotiza": 50,
                "4-reserva": 80,
                "5-ganada": 100,
                "6-perdida": 0
            }
            opp.probabilidad = probabilidades.get(opp.estado, 10)
            cambios.append(f"probabilidad={opp.probabilidad}%")
        
        # Completar descripción si falta
        if not opp.descripcion_estado:
            descripciones = {
                "1-abierta": "Oportunidad abierta - primer contacto",
                "2-visita": "Cliente realizó visita a la propiedad",
                "3-cotiza": "Cotización enviada al cliente",
                "4-reserva": "Cliente realizó reserva con seña",
                "5-ganada": "Contrato firmado - operación cerrada",
                "6-perdida": "Oportunidad perdida"
            }
            opp.descripcion_estado = descripciones.get(opp.estado, "Estado actualizado")
            cambios.append("descripcion_estado")
        
        # Completar moneda si falta
        if not opp.moneda_id:
            opp.moneda_id = 1  # ARS por defecto
            cambios.append("moneda_id=ARS")
        
        # Para oportunidades ganadas sin monto, asignar monto de referencia
        if opp.estado in ["5-ganada", "4-reserva"] and not opp.monto:
            propiedad = session.get(Propiedad, opp.propiedad_id)
            if propiedad and propiedad.precio_venta_estimado:
                opp.monto = propiedad.precio_venta_estimado
                opp.moneda_id = propiedad.precio_moneda_id or 2  # USD
                cambios.append(f"monto={opp.monto}")
            else:
                opp.monto = Decimal("150000.00")
                opp.moneda_id = 2  # USD
                cambios.append("monto=150000 USD (default)")
        
        # Completar condición de pago si falta para ganada/reserva
        if opp.estado in ["5-ganada", "4-reserva"] and not opp.condicion_pago_id:
            opp.condicion_pago_id = 1  # Asignar primera condición disponible
            cambios.append("condicion_pago_id=1")
        
        if cambios:
            session.add(opp)
            actualizadas += 1
            print(f"✅ Oportunidad {opp.id}: {', '.join(cambios)}")
    
    if actualizadas > 0:
        session.commit()
        print(f"\n✅ {actualizadas} oportunidades actualizadas")
    else:
        print("\n✅ Todas las oportunidades ya tienen los campos completos")
    
    session.close()

def verificar_consistencia_propiedades():
    """Verificar y corregir consistencia entre oportunidades y propiedades"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("VERIFICANDO CONSISTENCIA CON PROPIEDADES")
    print("="*80 + "\n")
    
    oportunidades = session.exec(select(CRMOportunidad)).all()
    corregidas = 0
    
    for opp in oportunidades:
        propiedad = session.get(Propiedad, opp.propiedad_id)
        if not propiedad:
            print(f"⚠️  Oportunidad {opp.id}: Propiedad {opp.propiedad_id} no existe")
            continue
        
        cambios_prop = []
        cambios_opp = []
        
        # 1. Sincronizar tipo de operación
        if opp.tipo_operacion_id != propiedad.tipo_operacion_id:
            # Priorizar el tipo de la oportunidad (más específico)
            if propiedad.tipo_operacion_id:
                opp.tipo_operacion_id = propiedad.tipo_operacion_id
                cambios_opp.append(f"tipo_operacion_id sincronizado con propiedad")
        
        # 2. Verificar estado ganada vs propiedad alquilada
        if opp.estado == "5-ganada":
            if propiedad.estado != "4-alquilada":
                propiedad.estado = "4-alquilada"
                propiedad.estado_fecha = opp.fecha_estado or datetime.now(UTC).date()
                propiedad.estado_comentario = f"Alquilada por oportunidad {opp.id}"
                cambios_prop.append("estado=4-alquilada")
                corregidas += 1
        
        # 3. Verificar propiedad disponible para oportunidades activas
        if opp.estado in ["1-abierta", "2-visita", "3-cotiza", "4-reserva"]:
            if propiedad.estado not in ["3-disponible", "4-alquilada"]:
                # Si la propiedad no está disponible, podría ser error de datos
                print(f"⚠️  Oportunidad {opp.id} activa pero propiedad {propiedad.id} en estado {propiedad.estado}")
        
        if cambios_opp:
            session.add(opp)
            print(f"✅ Oportunidad {opp.id}: {', '.join(cambios_opp)}")
        
        if cambios_prop:
            session.add(propiedad)
            print(f"✅ Propiedad {propiedad.id}: {', '.join(cambios_prop)}")
    
    if corregidas > 0:
        session.commit()
        print(f"\n✅ {corregidas} inconsistencias corregidas")
    else:
        print("\n✅ No se encontraron inconsistencias")
    
    session.close()

def resumen_final():
    """Mostrar resumen final del estado"""
    session = Session(engine)
    
    print("\n" + "="*80)
    print("RESUMEN FINAL")
    print("="*80 + "\n")
    
    oportunidades = session.exec(select(CRMOportunidad)).all()
    
    # Contar por estado
    por_estado = {}
    for opp in oportunidades:
        estado = opp.estado
        por_estado[estado] = por_estado.get(estado, 0) + 1
    
    print("Oportunidades por estado:")
    for estado, count in sorted(por_estado.items()):
        print(f"  {estado}: {count}")
    
    # Verificar completitud
    print("\nCompletitud de campos:")
    campos_completos = 0
    total_campos = 0
    
    for opp in oportunidades:
        campos = [
            opp.contacto_id is not None,
            opp.tipo_operacion_id is not None,
            opp.propiedad_id is not None,
            opp.estado is not None,
            opp.fecha_estado is not None,
            opp.moneda_id is not None,
            opp.descripcion_estado is not None,
            opp.probabilidad is not None,
            opp.responsable_id is not None,
        ]
        campos_completos += sum(campos)
        total_campos += len(campos)
    
    porcentaje = (campos_completos / total_campos * 100) if total_campos > 0 else 0
    print(f"  Campos obligatorios completos: {campos_completos}/{total_campos} ({porcentaje:.1f}%)")
    
    # Consistencia con propiedades
    inconsistentes = 0
    for opp in oportunidades:
        propiedad = session.get(Propiedad, opp.propiedad_id)
        if opp.estado == "5-ganada" and propiedad and propiedad.estado != "4-alquilada":
            inconsistentes += 1
    
    print(f"  Oportunidades ganadas con propiedad sincronizada: {len([o for o in oportunidades if o.estado == '5-ganada']) - inconsistentes}/{len([o for o in oportunidades if o.estado == '5-ganada'])}")
    
    session.close()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("VERIFICACIÓN Y COMPLETITUD DE OPORTUNIDADES")
    print("="*80)
    
    # 1. Analizar estado actual
    analizar_oportunidades()
    
    # 2. Completar campos faltantes
    completar_campos_faltantes()
    
    # 3. Verificar y corregir consistencia
    verificar_consistencia_propiedades()
    
    # 4. Resumen final
    resumen_final()
    
    print("\n" + "="*80)
    print("✅ PROCESO COMPLETADO")
    print("="*80 + "\n")
