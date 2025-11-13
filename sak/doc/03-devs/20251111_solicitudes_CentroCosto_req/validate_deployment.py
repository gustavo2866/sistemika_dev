"""
Script de validación post-deployment para Centro de Costo
Ejecutar DESPUÉS de aplicar migración y scripts de población

Ubicación: doc/03-devs/20251111_solicitudes_CentroCosto_req/validate_deployment.py
Ejecución: python doc/03-devs/20251111_solicitudes_CentroCosto_req/validate_deployment.py
"""
import sys
import os
from pathlib import Path
from typing import Dict, Any

# Agregar el directorio backend al path para imports
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Importar después de agregar al path
from sqlmodel import Session, select, text  # type: ignore
from app.db import engine  # type: ignore
from app.models import CentroCosto, Solicitud, SolicitudDetalle  # type: ignore


class DeploymentValidator:
    """Validador de deployment de Centro de Costo"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.success = []
        
    def log_success(self, message: str):
        """Registrar validación exitosa"""
        self.success.append(message)
        print(f"  ✅ {message}")
    
    def log_error(self, message: str):
        """Registrar error crítico"""
        self.errors.append(message)
        print(f"  ❌ ERROR: {message}")
    
    def log_warning(self, message: str):
        """Registrar advertencia"""
        self.warnings.append(message)
        print(f"  ⚠️  WARNING: {message}")
    
    def validate_migration_applied(self, session: Session) -> bool:
        """Validar que la migración 90f5f68df0bf está aplicada"""
        print("\n📋 Validando migración Alembic...")
        
        try:
            # Verificar tabla centros_costo existe
            result = session.exec(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'centros_costo'
                )
            """)).first()
            
            if result[0]:
                self.log_success("Tabla centros_costo existe")
            else:
                self.log_error("Tabla centros_costo NO existe")
                return False
            
            # Verificar columnas en solicitud_detalles
            result = session.exec(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'solicitud_detalles' 
                AND column_name IN ('precio', 'importe')
                ORDER BY column_name
            """)).all()
            
            if len(result) == 2:
                self.log_success("Campos precio e importe existen en solicitud_detalles")
            else:
                self.log_error(f"Faltan campos en solicitud_detalles: {len(result)}/2 encontrados")
                return False
            
            # Verificar columna centro_costo_id en solicitudes
            result = session.exec(text("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'solicitudes' 
                AND column_name = 'centro_costo_id'
            """)).first()
            
            if result and result[0] == 'NO':
                self.log_success("Campo centro_costo_id existe y es NOT NULL en solicitudes")
            else:
                self.log_error("Campo centro_costo_id no existe o es nullable")
                return False
            
            # Verificar FK constraint
            result = session.exec(text("""
                SELECT COUNT(*) 
                FROM information_schema.table_constraints 
                WHERE constraint_type = 'FOREIGN KEY' 
                AND table_name = 'solicitudes'
                AND constraint_name LIKE '%centro_costo%'
            """)).first()
            
            if result[0] > 0:
                self.log_success("FK constraint entre solicitudes y centros_costo existe")
            else:
                self.log_error("FK constraint NO existe")
                return False
            
            return True
            
        except Exception as e:
            self.log_error(f"Error validando migración: {e}")
            return False
    
    def validate_data_integrity(self, session: Session) -> bool:
        """Validar integridad de datos"""
        print("\n📊 Validando integridad de datos...")
        
        try:
            # Verificar que no hay solicitudes sin centro de costo
            result = session.exec(
                select(Solicitud).where(Solicitud.centro_costo_id.is_(None))
            ).all()
            
            if len(result) == 0:
                self.log_success("Todas las solicitudes tienen centro_costo_id asignado")
            else:
                self.log_error(f"{len(result)} solicitudes sin centro_costo_id")
                return False
            
            # Verificar que existe al menos el centro "Sin Asignar"
            sin_asignar = session.exec(
                select(CentroCosto).where(CentroCosto.nombre == "Sin Asignar")
            ).first()
            
            if sin_asignar and sin_asignar.id == 1:
                self.log_success('Centro de costo "Sin Asignar" (ID=1) existe')
            else:
                self.log_error('Centro de costo "Sin Asignar" no existe o tiene ID incorrecto')
                return False
            
            # Verificar cantidad de centros de costo
            centros_count = session.exec(
                select(CentroCosto).where(CentroCosto.deleted_at.is_(None))
            ).all()
            
            if len(centros_count) >= 5:  # Min: Sin Asignar + 4 generales
                self.log_success(f"Total de centros de costo: {len(centros_count)}")
            else:
                self.log_warning(f"Solo {len(centros_count)} centros de costo (esperado >= 5)")
            
            # Verificar distribución por tipo
            tipos = {}
            for centro in centros_count:
                tipos[centro.tipo] = tipos.get(centro.tipo, 0) + 1
            
            print(f"     Distribución por tipo:")
            for tipo, count in sorted(tipos.items()):
                print(f"       - {tipo}: {count}")
            
            if "General" in tipos and tipos["General"] >= 5:
                self.log_success(f"Centros de costo tipo General: {tipos['General']}")
            else:
                self.log_warning(f"Centros tipo General insuficientes: {tipos.get('General', 0)}")
            
            # Verificar campos precio/importe en solicitud_detalles
            result = session.exec(text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN precio IS NULL THEN 1 END) as precio_null,
                    COUNT(CASE WHEN importe IS NULL THEN 1 END) as importe_null
                FROM solicitud_detalles
            """)).first()
            
            if result[1] == 0 and result[2] == 0:
                self.log_success(f"Todos los detalles ({result[0]}) tienen precio e importe no NULL")
            else:
                self.log_error(f"Detalles con valores NULL: precio={result[1]}, importe={result[2]}")
                return False
            
            return True
            
        except Exception as e:
            self.log_error(f"Error validando integridad: {e}")
            return False
    
    def validate_indexes(self, session: Session) -> bool:
        """Validar índices creados"""
        print("\n🔍 Validando índices...")
        
        try:
            result = session.exec(text("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'centros_costo'
                ORDER BY indexname
            """)).all()
            
            expected_indexes = ['ix_centros_costo_nombre', 'ix_centros_costo_tipo', 'ix_centros_costo_codigo_contable']
            found_indexes = [idx[0] for idx in result]
            
            for expected in expected_indexes:
                if expected in found_indexes:
                    self.log_success(f"Índice {expected} existe")
                else:
                    self.log_warning(f"Índice {expected} no encontrado")
            
            return True
            
        except Exception as e:
            self.log_error(f"Error validando índices: {e}")
            return False
    
    def validate_relationships(self, session: Session) -> bool:
        """Validar relaciones funcionan correctamente"""
        print("\n🔗 Validando relaciones...")
        
        try:
            # Obtener una solicitud con centro de costo
            solicitud = session.exec(
                select(Solicitud).limit(1)
            ).first()
            
            if not solicitud:
                self.log_warning("No hay solicitudes para validar relación")
                return True
            
            # Verificar que se puede acceder al centro_costo
            if solicitud.centro_costo:
                self.log_success(f"Relación solicitud->centro_costo funciona (Centro: {solicitud.centro_costo.nombre})")
            else:
                self.log_error("No se puede acceder a solicitud.centro_costo")
                return False
            
            # Verificar relación inversa
            centro = session.exec(select(CentroCosto).where(CentroCosto.id == 1)).first()
            if centro:
                solicitudes_count = len(centro.solicitudes)
                self.log_success(f"Relación centro_costo->solicitudes funciona ({solicitudes_count} solicitudes)")
            else:
                self.log_error("No se puede verificar relación centro_costo->solicitudes")
                return False
            
            return True
            
        except Exception as e:
            self.log_error(f"Error validando relaciones: {e}")
            return False
    
    def validate_api_compatibility(self, session: Session) -> bool:
        """Validar compatibilidad con API (searchable fields, etc.)"""
        print("\n🌐 Validando configuración de API...")
        
        try:
            # Verificar que el modelo tiene __searchable_fields__
            if hasattr(CentroCosto, '__searchable_fields__'):
                fields = CentroCosto.__searchable_fields__
                self.log_success(f"CentroCosto.__searchable_fields__ definido: {fields}")
            else:
                self.log_warning("CentroCosto no tiene __searchable_fields__ definido")
            
            # Verificar que Solicitud tiene __expanded_list_relations__
            if hasattr(Solicitud, '__expanded_list_relations__'):
                relations = Solicitud.__expanded_list_relations__
                if 'centro_costo' in relations:
                    self.log_success(f"Solicitud expandirá centro_costo en API")
                else:
                    self.log_warning("centro_costo no está en __expanded_list_relations__")
            else:
                self.log_warning("Solicitud no tiene __expanded_list_relations__")
            
            return True
            
        except Exception as e:
            self.log_error(f"Error validando configuración API: {e}")
            return False
    
    def print_summary(self):
        """Imprimir resumen de validación"""
        print("\n" + "="*70)
        print("📊 RESUMEN DE VALIDACIÓN")
        print("="*70)
        
        print(f"\n✅ Validaciones exitosas: {len(self.success)}")
        print(f"⚠️  Advertencias: {len(self.warnings)}")
        print(f"❌ Errores críticos: {len(self.errors)}")
        
        if self.errors:
            print("\n❌ ERRORES DETECTADOS:")
            for error in self.errors:
                print(f"   - {error}")
        
        if self.warnings:
            print("\n⚠️  ADVERTENCIAS:")
            for warning in self.warnings:
                print(f"   - {warning}")
        
        print("\n" + "="*70)
        
        if self.errors:
            print("❌ DEPLOYMENT FALLÓ - Revisar errores críticos")
            return False
        elif self.warnings:
            print("⚠️  DEPLOYMENT COMPLETADO CON ADVERTENCIAS")
            return True
        else:
            print("✅ DEPLOYMENT EXITOSO - Todas las validaciones pasaron")
            return True


def main():
    """Ejecutar validación completa"""
    print("🔍 Iniciando validación de deployment...")
    print(f"🗄️  Base de datos: {os.getenv('DATABASE_URL', 'LOCAL')[:50]}...")
    
    validator = DeploymentValidator()
    
    try:
        with Session(engine) as session:
            # Ejecutar validaciones
            migration_ok = validator.validate_migration_applied(session)
            data_ok = validator.validate_data_integrity(session)
            indexes_ok = validator.validate_indexes(session)
            relations_ok = validator.validate_relationships(session)
            api_ok = validator.validate_api_compatibility(session)
            
            # Imprimir resumen
            validator.print_summary()
            
            # Retornar código de salida
            if validator.errors:
                sys.exit(1)
            else:
                sys.exit(0)
                
    except Exception as e:
        print(f"\n❌ Error fatal durante validación: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
