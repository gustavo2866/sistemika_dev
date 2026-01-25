#!/usr/bin/env python3
"""
Script para verificar que los modelos se cargan correctamente después de los cambios
"""

import os
import sys

# Agregar el directorio padre al path para importar módulos de la app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    print("🔍 Importando modelos...")
    
    from app.models.proveedor import Proveedor
    from app.models.articulo import Articulo
    print("✅ Modelos Proveedor y Articulo importados correctamente")
    
    from app.db import get_session
    print("✅ Sesión de DB importada correctamente")
    
    # Probar una consulta simple
    with next(get_session()) as session:
        print("\n🔍 Probando consultas...")
        
        # Contar proveedores
        proveedores = session.query(Proveedor).count()
        print(f"✅ Proveedores en DB: {proveedores}")
        
        # Contar artículos
        articulos = session.query(Articulo).count()
        print(f"✅ Artículos en DB: {articulos}")
        
        # Probar una relación
        proveedor = session.query(Proveedor).first()
        if proveedor:
            print(f"✅ Primer proveedor: {proveedor.nombre}")
            print(f"✅ Artículos del proveedor: {len(proveedor.articulos)}")
            
            # Probar la nueva relación default_articulos
            if proveedor.default_articulos:
                print(f"✅ Artículo por defecto: {proveedor.default_articulos.nombre}")
            else:
                print(f"ℹ️  Sin artículo por defecto (esperado)")
        
        print(f"\n🎯 ¡Modelos funcionando correctamente!")

except ImportError as e:
    print(f"❌ Error de importación: {str(e)}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error general: {str(e)}")
    sys.exit(1)