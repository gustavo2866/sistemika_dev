"""
Script de validación post-migración para eventos refactorizados.
Ejecutar después de aplicar la migración 022_refactor_crm_eventos.

Valida:
1. Estructura de tabla crm_eventos
2. Migración de datos (títulos, tipos, resultados)
3. Eliminación de columnas antiguas
4. Integridad de índices y constraints
5. Eventos huérfanos (sin oportunidad)
"""

import sys
from pathlib import Path

# Agregar el directorio backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import inspect, text
from app.db import engine
from app.models import CRMEvento
from app.models.enums import EstadoEvento, TipoEvento


def validar_estructura_tabla():
    """Valida que la tabla tenga las columnas correctas"""
    print("\n=== VALIDACIÓN DE ESTRUCTURA ===")
    inspector = inspect(engine)
    columns = inspector.get_columns("crm_eventos")
    column_names = {col["name"] for col in columns}
    
    # Columnas esperadas
    expected = {
        "id", "oportunidad_id", "titulo", "tipo_evento", "descripcion",
        "fecha_evento", "resultado", "estado", "asignado_a_id",
        "created_at", "updated_at", "deleted_at"
    }
    
    # Columnas que NO deben existir
    forbidden = {
        "contacto_id", "tipo_id", "motivo_id", "origen_lead_id",
        "proximo_paso", "fecha_compromiso", "fecha_recordatorio"
    }
    
    missing = expected - column_names
    extra_forbidden = forbidden & column_names
    
    if missing:
        print(f"❌ FALTAN columnas: {missing}")
        return False
    
    if extra_forbidden:
        print(f"❌ COLUMNAS ANTIGUAS aún presentes: {extra_forbidden}")
        return False
    
    print("✅ Estructura de tabla correcta")
    
    # Validar tipos de columnas
    tipo_titulo = next((c["type"] for c in columns if c["name"] == "titulo"), None)
    tipo_tipo_evento = next((c["type"] for c in columns if c["name"] == "tipo_evento"), None)
    tipo_resultado = next((c["type"] for c in columns if c["name"] == "resultado"), None)
    
    print(f"   - titulo: {tipo_titulo}")
    print(f"   - tipo_evento: {tipo_tipo_evento}")
    print(f"   - resultado: {tipo_resultado}")
    
    return True


def validar_constraints():
    """Valida foreign keys y constraints"""
    print("\n=== VALIDACIÓN DE CONSTRAINTS ===")
    inspector = inspect(engine)
    
    # Foreign keys
    fks = inspector.get_foreign_keys("crm_eventos")
    fk_columns = {fk["constrained_columns"][0] for fk in fks}
    
    expected_fks = {"oportunidad_id", "asignado_a_id"}
    missing_fks = expected_fks - fk_columns
    
    if missing_fks:
        print(f"❌ FALTAN foreign keys: {missing_fks}")
        return False
    
    print("✅ Foreign keys correctos")
    for fk in fks:
        print(f"   - {fk['constrained_columns'][0]} → {fk['referred_table']}.{fk['referred_columns'][0]}")
    
    return True


def validar_indices():
    """Valida que los índices necesarios existan"""
    print("\n=== VALIDACIÓN DE ÍNDICES ===")
    inspector = inspect(engine)
    indexes = inspector.get_indexes("crm_eventos")
    
    # Índices esperados (nombres pueden variar)
    indexed_columns = set()
    for idx in indexes:
        indexed_columns.update(idx["column_names"])
    
    expected_indexes = {"oportunidad_id", "fecha_evento", "estado", "tipo_evento"}
    missing_indexes = expected_indexes - indexed_columns
    
    if missing_indexes:
        print(f"⚠️  FALTAN índices en: {missing_indexes}")
    else:
        print("✅ Todos los índices necesarios están presentes")
    
    print("   Índices encontrados:")
    for idx in indexes:
        print(f"   - {idx['name']}: {idx['column_names']}")
    
    return True


def validar_datos():
    """Valida la integridad de los datos migrados"""
    print("\n=== VALIDACIÓN DE DATOS ===")
    
    from sqlmodel import Session, select, func
    
    with Session(engine) as session:
        # Contar total de eventos
        total = session.exec(select(func.count(CRMEvento.id))).one()
        print(f"Total de eventos: {total}")
        
        if total == 0:
            print("⚠️  No hay eventos en la tabla")
            return True
        
        # Validar títulos (no deben estar vacíos)
        sin_titulo = session.exec(
            select(func.count(CRMEvento.id))
            .where((CRMEvento.titulo.is_(None)) | (CRMEvento.titulo == ""))
        ).one()
        
        if sin_titulo > 0:
            print(f"❌ {sin_titulo} eventos sin título")
            return False
        else:
            print("✅ Todos los eventos tienen título")
        
        # Validar tipo_evento
        tipos_invalidos = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.tipo_evento.not_in([t.value for t in TipoEvento]))
        ).one()
        
        if tipos_invalidos > 0:
            print(f"❌ {tipos_invalidos} eventos con tipo_evento inválido")
            return False
        else:
            print("✅ Todos los eventos tienen tipo_evento válido")
        
        # Distribución por tipo
        print("\n   Distribución por tipo:")
        for tipo in TipoEvento:
            count = session.exec(
                select(func.count(CRMEvento.id))
                .where(CRMEvento.tipo_evento == tipo.value)
            ).one()
            if count > 0:
                print(f"   - {tipo.value}: {count}")
        
        # Validar estados
        estados_invalidos = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.estado.not_in([e.value for e in EstadoEvento]))
        ).one()
        
        if estados_invalidos > 0:
            print(f"❌ {estados_invalidos} eventos con estado inválido")
            return False
        else:
            print("✅ Todos los eventos tienen estado válido")
        
        # Distribución por estado
        print("\n   Distribución por estado:")
        for estado in EstadoEvento:
            count = session.exec(
                select(func.count(CRMEvento.id))
                .where(CRMEvento.estado == estado.value)
            ).one()
            if count > 0:
                print(f"   - {estado.value}: {count}")
        
        # Validar oportunidad_id (no debe ser NULL)
        sin_oportunidad = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.oportunidad_id.is_(None))
        ).one()
        
        if sin_oportunidad > 0:
            print(f"❌ {sin_oportunidad} eventos sin oportunidad_id (huérfanos)")
            return False
        else:
            print("✅ Todos los eventos tienen oportunidad_id")
        
        # Validar eventos cerrados con resultado
        cerrados_sin_resultado = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.estado.in_([
                EstadoEvento.REALIZADO.value,
                EstadoEvento.CANCELADO.value,
                EstadoEvento.REAGENDAR.value
            ]))
            .where((CRMEvento.resultado.is_(None)) | (CRMEvento.resultado == ""))
        ).one()
        
        if cerrados_sin_resultado > 0:
            print(f"⚠️  {cerrados_sin_resultado} eventos cerrados sin resultado")
        else:
            print("✅ Todos los eventos cerrados tienen resultado")
    
    return True


def validar_eventos_huerfanos():
    """Verifica si hay eventos que quedaron huérfanos en la migración"""
    print("\n=== VALIDACIÓN DE EVENTOS HUÉRFANOS ===")
    
    with engine.connect() as conn:
        # Eventos sin oportunidad válida
        result = conn.execute(text("""
            SELECT COUNT(*)
            FROM crm_eventos e
            LEFT JOIN crm_oportunidades o ON e.oportunidad_id = o.id
            WHERE o.id IS NULL AND e.deleted_at IS NULL
        """))
        
        huerfanos = result.scalar()
        
        if huerfanos > 0:
            print(f"❌ {huerfanos} eventos con oportunidad_id que no existe")
            return False
        else:
            print("✅ Todos los eventos tienen oportunidades válidas")
    
    return True


def generar_resumen():
    """Genera un resumen estadístico de la migración"""
    print("\n=== RESUMEN ESTADÍSTICO ===")
    
    from sqlmodel import Session, select, func
    
    with Session(engine) as session:
        # Total por estado
        print("Eventos por estado:")
        for estado in EstadoEvento:
            count = session.exec(
                select(func.count(CRMEvento.id))
                .where(CRMEvento.estado == estado.value)
                .where(CRMEvento.deleted_at.is_(None))
            ).one()
            print(f"  {estado.value}: {count}")
        
        # Total por tipo
        print("\nEventos por tipo:")
        for tipo in TipoEvento:
            count = session.exec(
                select(func.count(CRMEvento.id))
                .where(CRMEvento.tipo_evento == tipo.value)
                .where(CRMEvento.deleted_at.is_(None))
            ).one()
            print(f"  {tipo.value}: {count}")
        
        # Eventos con/sin resultado
        con_resultado = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.resultado.isnot(None))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        sin_resultado = session.exec(
            select(func.count(CRMEvento.id))
            .where(CRMEvento.resultado.is_(None))
            .where(CRMEvento.deleted_at.is_(None))
        ).one()
        
        print(f"\nCon resultado: {con_resultado}")
        print(f"Sin resultado: {sin_resultado}")


def main():
    """Ejecuta todas las validaciones"""
    print("=" * 60)
    print("SCRIPT DE VALIDACIÓN - MIGRACIÓN 022 REFACTOR EVENTOS")
    print("=" * 60)
    
    validaciones = [
        ("Estructura", validar_estructura_tabla),
        ("Constraints", validar_constraints),
        ("Índices", validar_indices),
        ("Datos", validar_datos),
        ("Huérfanos", validar_eventos_huerfanos),
    ]
    
    resultados = {}
    
    for nombre, func in validaciones:
        try:
            resultado = func()
            resultados[nombre] = resultado
        except Exception as e:
            print(f"\n❌ ERROR en validación '{nombre}': {e}")
            resultados[nombre] = False
    
    # Resumen estadístico
    try:
        generar_resumen()
    except Exception as e:
        print(f"\n⚠️  Error al generar resumen: {e}")
    
    # Resultado final
    print("\n" + "=" * 60)
    print("RESULTADO FINAL")
    print("=" * 60)
    
    for nombre, resultado in resultados.items():
        status = "✅ PASS" if resultado else "❌ FAIL"
        print(f"{nombre}: {status}")
    
    if all(resultados.values()):
        print("\n✅ VALIDACIÓN EXITOSA - Migración completada correctamente")
        return 0
    else:
        print("\n❌ VALIDACIÓN FALLIDA - Revisar errores arriba")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
