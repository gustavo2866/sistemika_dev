"""
Script para poblar la base d    # Verificar y crear tipos de comprobante
    tipos_comp = session.exec(select(TipoComprobante)).all()
    if not tipos_comp:
        print("   📄 Creando tipos de comprobante...")
        tipos_comprobante = [
            TipoComprobante(name="Factura A"),
            TipoComprobante(name="Factura B"),
            TipoComprobante(name="Factura C"),
            TipoComprobante(name="Nota de Crédito A"),
            TipoComprobante(name="Nota de Débito A"),
        ]
        for tc in tipos_comprobante:
            session.add(tc)
        session.commit()
        tipos_comp = tipos_comprobante
        print(f"   ✅ Creados {len(tipos_comp)} tipos de comprobante")
    else:
        print(f"   ✅ Tipos de comprobante: {len(tipos_comp)}")atos de prueba
Respeta la integridad referencial del modelo
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from sqlmodel import Session, select
from app.db import engine
from app.models import (
    User, Paises, TipoOperacion, TipoComprobante, MetodoPago,
    Propiedad, Proveedor, Articulo, Factura, FacturaDetalle,
    FacturaImpuesto, Solicitud, SolicitudDetalle, Tarea
)

def limpiar_datos():
    """Limpia todos los datos de las tablas (opcional)"""
    print("⚠️  Limpiando datos existentes...")
    with Session(engine) as session:
        # Orden inverso a las dependencias
        session.query(FacturaImpuesto).delete()
        session.query(FacturaDetalle).delete()
        session.query(Factura).delete()
        session.query(SolicitudDetalle).delete()
        session.query(Solicitud).delete()
        session.query(Tarea).delete()
        # No borramos datos de catálogo
        session.commit()
    print("✅ Datos limpiados")

def crear_catalogos_basicos(session: Session):
    """Crea datos de catálogo básicos si no existen"""
    print("\n📋 Verificando y creando catálogos básicos...")
    
    # Verificar y crear tipos de comprobante
    tipos_comp = session.exec(select(TipoComprobante)).all()
    if not tipos_comp:
        print("   � Creando tipos de comprobante...")
        tipos_comprobante = [
            TipoComprobante(codigo="FA", nombre="Factura A", descripcion="Factura tipo A"),
            TipoComprobante(codigo="FB", nombre="Factura B", descripcion="Factura tipo B"),
            TipoComprobante(codigo="FC", nombre="Factura C", descripcion="Factura tipo C"),
            TipoComprobante(codigo="NC", nombre="Nota de Crédito", descripcion="Nota de crédito"),
            TipoComprobante(codigo="ND", nombre="Nota de Débito", descripcion="Nota de débito"),
        ]
        for tc in tipos_comprobante:
            session.add(tc)
        session.commit()
        tipos_comp = tipos_comprobante
        print(f"   ✅ Creados {len(tipos_comp)} tipos de comprobante")
    else:
        print(f"   ✅ Tipos de comprobante: {len(tipos_comp)}")
    
    # Verificar y crear métodos de pago
    metodos = session.exec(select(MetodoPago)).all()
    if not metodos:
        print("   💳 Creando métodos de pago...")
        metodos_pago = [
            MetodoPago(nombre="Efectivo"),
            MetodoPago(nombre="Transferencia"),
            MetodoPago(nombre="Cheque"),
            MetodoPago(nombre="Tarjeta de Crédito"),
            MetodoPago(nombre="Tarjeta de Débito"),
        ]
        for mp in metodos_pago:
            session.add(mp)
        session.commit()
        metodos = metodos_pago
        print(f"   ✅ Creados {len(metodos)} métodos de pago")
    else:
        print(f"   ✅ Métodos de pago: {len(metodos)}")
    
    # Verificar países
    paises = session.exec(select(Paises)).all()
    print(f"   ✅ Países: {len(paises)}")
    
    # Verificar tipos de operación
    tipos_op = session.exec(select(TipoOperacion)).all()
    print(f"   ✅ Tipos de operación: {len(tipos_op)}")
    
    return len(paises) > 0 and len(tipos_op) > 0 and len(tipos_comp) > 0 and len(metodos) > 0

def crear_usuarios(session: Session):
    """Crea usuarios de prueba"""
    print("\n👥 Creando usuarios...")
    
    usuarios = [
        User(
            nombre="Juan Pérez",
            email="juan.perez@example.com",
            telefono="+5491112345678",
            activo=True
        ),
        User(
            nombre="María González",
            email="maria.gonzalez@example.com",
            telefono="+5491198765432",
            activo=True
        ),
        User(
            nombre="Carlos López",
            email="carlos.lopez@example.com",
            telefono="+5491155555555",
            activo=True
        ),
        User(
            nombre="Ana Martínez",
            email="ana.martinez@example.com",
            telefono="+5491144444444",
            activo=True
        ),
    ]
    
    for usuario in usuarios:
        # Verificar si ya existe
        existing = session.exec(
            select(User).where(User.email == usuario.email)
        ).first()
        if not existing:
            session.add(usuario)
            print(f"   ✅ Usuario creado: {usuario.nombre}")
        else:
            print(f"   ⚠️  Usuario ya existe: {usuario.nombre}")
    
    session.commit()
    return session.exec(select(User)).all()

def crear_propiedades(session: Session):
    """Crea propiedades de prueba"""
    print("\n🏠 Creando propiedades...")
    
    propiedades = [
        Propiedad(
            nombre="Edificio Centro",
            tipo="Edificio",
            propietario="Inversiones Inmobiliarias SA",
            estado="activa"
        ),
        Propiedad(
            nombre="Complejo Norte",
            tipo="Complejo",
            propietario="Desarrollos Norte SRL",
            estado="activa"
        ),
        Propiedad(
            nombre="Torre Palermo",
            tipo="Torre",
            propietario="Grupo Palermo SA",
            estado="activa"
        ),
    ]
    
    for propiedad in propiedades:
        existing = session.exec(
            select(Propiedad).where(Propiedad.nombre == propiedad.nombre)
        ).first()
        if not existing:
            session.add(propiedad)
            print(f"   ✅ Propiedad creada: {propiedad.nombre}")
        else:
            print(f"   ⚠️  Propiedad ya existe: {propiedad.nombre}")
    
    session.commit()
    return session.exec(select(Propiedad)).all()

def crear_proveedores(session: Session):
    """Crea proveedores de prueba"""
    print("\n🏢 Creando proveedores...")
    
    # Obtener un país (Argentina)
    pais = session.exec(select(Paises).where(Paises.name == "Argentina")).first()
    if not pais:
        pais = session.exec(select(Paises)).first()
    
    proveedores = [
        Proveedor(
            nombre="Eléctricos SA",
            razon_social="Servicios Eléctricos SA",
            cuit="30-12345678-9",
            email="contacto@electricos.com",
            telefono="+5491112341234",
            direccion="Av. Industria 100, Buenos Aires",
            activo=True
        ),
        Proveedor(
            nombre="ConSur",
            razon_social="Construcciones del Sur SRL",
            cuit="30-98765432-1",
            email="info@consur.com",
            telefono="+5491198769876",
            direccion="Calle Construcción 200, Buenos Aires",
            activo=True
        ),
        Proveedor(
            nombre="Limpi Total",
            razon_social="Limpieza Total SA",
            cuit="30-11223344-5",
            email="ventas@limpiezatotal.com",
            telefono="+5491155551122",
            direccion="Av. Limpieza 300, Buenos Aires",
            activo=True
        ),
        Proveedor(
            nombre="TecSys",
            razon_social="Tecnología y Sistemas SRL",
            cuit="30-99887766-3",
            email="contacto@tecsys.com",
            telefono="+5491144443333",
            direccion="Calle Tecnología 400, Buenos Aires",
            activo=True
        ),
    ]
    
    for proveedor in proveedores:
        existing = session.exec(
            select(Proveedor).where(Proveedor.cuit == proveedor.cuit)
        ).first()
        if not existing:
            session.add(proveedor)
            print(f"   ✅ Proveedor creado: {proveedor.razon_social}")
        else:
            print(f"   ⚠️  Proveedor ya existe: {proveedor.razon_social}")
    
    session.commit()
    return session.exec(select(Proveedor)).all()

def crear_articulos(session: Session, proveedores):
    """Crea artículos de prueba"""
    print("\n📦 Creando artículos...")
    
    # Obtener un proveedor por defecto
    prov_default = proveedores[0] if proveedores else session.exec(select(Proveedor)).first()
    
    articulos = [
        Articulo(
            nombre="Cable Eléctrico 2.5mm",
            tipo_articulo="Material Eléctrico",
            unidad_medida="MTR",
            marca="CableMax",
            sku="CABLE-25MM-001",
            precio=Decimal("150.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
        Articulo(
            nombre="Lámpara LED 12W",
            tipo_articulo="Iluminación",
            unidad_medida="UNI",
            marca="LedTech",
            sku="LED-12W-001",
            precio=Decimal("450.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
        Articulo(
            nombre="Cemento Portland",
            tipo_articulo="Material Construcción",
            unidad_medida="BOL",
            marca="Holcim",
            sku="CEM-PORT-50",
            precio=Decimal("2500.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
        Articulo(
            nombre="Arena Fina",
            tipo_articulo="Material Construcción",
            unidad_medida="M3",
            marca="La Cantera",
            sku="ARE-FIN-01",
            precio=Decimal("3500.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
        Articulo(
            nombre="Detergente Industrial",
            tipo_articulo="Limpieza",
            unidad_medida="LTS",
            marca="CleanPro",
            sku="DET-IND-5L",
            precio=Decimal("1200.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
        Articulo(
            nombre="Servidor Dell PowerEdge",
            tipo_articulo="Tecnología",
            unidad_medida="UNI",
            marca="Dell",
            sku="DELL-R740-001",
            precio=Decimal("450000.00"),
            proveedor_id=prov_default.id if prov_default else None
        ),
    ]
    
    for articulo in articulos:
        existing = session.exec(
            select(Articulo).where(Articulo.nombre == articulo.nombre)
        ).first()
        if not existing:
            session.add(articulo)
            print(f"   ✅ Artículo creado: {articulo.nombre}")
        else:
            print(f"   ⚠️  Artículo ya existe: {articulo.nombre}")
    
    session.commit()
    return session.exec(select(Articulo)).all()

def crear_facturas(session: Session, usuarios, proveedores, propiedades):
    """Crea facturas de prueba con detalles e impuestos"""
    print("\n🧾 Creando facturas...")
    
    # Obtener datos de catálogo
    tipo_comp = session.exec(select(TipoComprobante)).first()
    tipo_op = session.exec(select(TipoOperacion)).first()
    metodo_pago = session.exec(select(MetodoPago)).first()
    articulos = session.exec(select(Articulo)).all()
    
    if not all([tipo_comp, tipo_op, metodo_pago, usuarios, proveedores, articulos]):
        print("   ❌ Faltan datos de catálogo necesarios")
        return []
    
    fecha_base = date.today() - timedelta(days=30)
    
    facturas_data = [
        {
            "numero": "0001-00000123",
            "punto_venta": "0001",
            "fecha_emision": (fecha_base + timedelta(days=1)).isoformat(),
            "proveedor": proveedores[0],
            "propiedad": propiedades[0],
            "articulos": [
                {"articulo": articulos[0], "cantidad": 100, "precio": Decimal("150.00")},
                {"articulo": articulos[1], "cantidad": 20, "precio": Decimal("450.00")},
            ]
        },
        {
            "numero": "0002-00000456",
            "punto_venta": "0002",
            "fecha_emision": (fecha_base + timedelta(days=5)).isoformat(),
            "proveedor": proveedores[1],
            "propiedad": propiedades[1],
            "articulos": [
                {"articulo": articulos[2], "cantidad": 50, "precio": Decimal("2500.00")},
                {"articulo": articulos[3], "cantidad": 10, "precio": Decimal("3500.00")},
            ]
        },
        {
            "numero": "0001-00000789",
            "punto_venta": "0001",
            "fecha_emision": (fecha_base + timedelta(days=10)).isoformat(),
            "proveedor": proveedores[2],
            "propiedad": propiedades[2],
            "articulos": [
                {"articulo": articulos[4], "cantidad": 30, "precio": Decimal("1200.00")},
            ]
        },
        {
            "numero": "0003-00001234",
            "punto_venta": "0003",
            "fecha_emision": (fecha_base + timedelta(days=15)).isoformat(),
            "proveedor": proveedores[3],
            "propiedad": propiedades[0],
            "articulos": [
                {"articulo": articulos[5], "cantidad": 2, "precio": Decimal("450000.00")},
            ]
        },
    ]
    
    facturas_creadas = []
    
    for i, fac_data in enumerate(facturas_data):
        # Verificar si ya existe
        existing = session.exec(
            select(Factura).where(Factura.numero == fac_data["numero"])
        ).first()
        
        if existing:
            print(f"   ⚠️  Factura ya existe: {fac_data['numero']}")
            continue
        
        # Calcular totales
        subtotal = sum(
            item["cantidad"] * item["precio"] 
            for item in fac_data["articulos"]
        )
        impuestos = subtotal * Decimal("0.21")  # IVA 21%
        total = subtotal + impuestos
        
        # Crear factura
        factura = Factura(
            numero=fac_data["numero"],
            punto_venta=fac_data["punto_venta"],
            id_tipocomprobante=tipo_comp.id,
            fecha_emision=fac_data["fecha_emision"],
            fecha_vencimiento=(
                date.fromisoformat(fac_data["fecha_emision"]) + timedelta(days=30)
            ).isoformat(),
            subtotal=subtotal,
            total_impuestos=impuestos,
            total=total,
            estado="pendiente",
            observaciones=f"Factura de prueba #{i+1}",
            proveedor_id=fac_data["proveedor"].id,
            tipo_operacion_id=tipo_op.id,
            usuario_responsable_id=usuarios[i % len(usuarios)].id,
            metodo_pago_id=metodo_pago.id,
            registrado_por_id=usuarios[0].id,
            propiedad_id=fac_data["propiedad"].id,
        )
        
        session.add(factura)
        session.flush()  # Para obtener el ID
        
        # Crear detalles
        for item in fac_data["articulos"]:
            detalle = FacturaDetalle(
                factura_id=factura.id,
                articulo_id=item["articulo"].id,
                descripcion=item["articulo"].nombre,  # Usar nombre como descripción
                cantidad=item["cantidad"],
                precio_unitario=item["precio"],
                subtotal=item["cantidad"] * item["precio"],
            )
            session.add(detalle)
        
        # Crear impuesto IVA
        impuesto = FacturaImpuesto(
            factura_id=factura.id,
            tipo_impuesto="IVA",
            descripcion="IVA 21%",
            base_imponible=subtotal,
            porcentaje=Decimal("21.00"),
            monto=impuestos,
        )
        session.add(impuesto)
        
        facturas_creadas.append(factura)
        print(f"   ✅ Factura creada: {factura.numero} - Total: ${total}")
    
    session.commit()
    return facturas_creadas

def crear_solicitudes(session: Session, usuarios, articulos):
    """Crea solicitudes de compra de prueba"""
    print("\n📝 Creando solicitudes...")
    
    if not usuarios or not articulos:
        print("   ❌ Faltan usuarios o artículos")
        return []
    
    fecha_base = date.today()
    
    solicitudes_data = [
        {
            "fecha_necesidad": fecha_base + timedelta(days=7),
            "comentario": "Solicitud de materiales eléctricos urgente",
            "solicitante": usuarios[0],
            "articulos": [
                {"articulo": articulos[0], "cantidad": 200},
                {"articulo": articulos[1], "cantidad": 50},
            ]
        },
        {
            "fecha_necesidad": fecha_base + timedelta(days=14),
            "comentario": "Materiales para obra nueva",
            "solicitante": usuarios[1],
            "articulos": [
                {"articulo": articulos[2], "cantidad": 100},
                {"articulo": articulos[3], "cantidad": 20},
            ]
        },
        {
            "fecha_necesidad": fecha_base + timedelta(days=21),
            "comentario": "Insumos de limpieza mensuales",
            "solicitante": usuarios[2],
            "articulos": [
                {"articulo": articulos[4], "cantidad": 50},
            ]
        },
    ]
    
    solicitudes_creadas = []
    
    for sol_data in solicitudes_data:
        solicitud = Solicitud(
            tipo="normal",
            fecha_necesidad=sol_data["fecha_necesidad"],
            comentario=sol_data["comentario"],
            solicitante_id=sol_data["solicitante"].id,
        )
        
        session.add(solicitud)
        session.flush()
        
        # Crear detalles
        for item in sol_data["articulos"]:
            detalle = SolicitudDetalle(
                solicitud_id=solicitud.id,
                articulo_id=item["articulo"].id,
                cantidad_solicitada=item["cantidad"],
            )
            session.add(detalle)
        
        solicitudes_creadas.append(solicitud)
        print(f"   ✅ Solicitud creada para: {sol_data['solicitante'].nombre}")
    
    session.commit()
    return solicitudes_creadas

def crear_tareas(session: Session, usuarios):
    """Crea tareas de prueba"""
    print("\n✅ Creando tareas...")
    
    if not usuarios:
        print("   ❌ Faltan usuarios")
        return []
    
    tareas = [
        Tarea(
            titulo="Revisar facturas pendientes",
            descripcion="Revisar y aprobar facturas del mes",
            fecha_vencimiento=date.today() + timedelta(days=3),
            prioridad="alta",
            estado="pendiente",
            user_id=usuarios[0].id,
        ),
        Tarea(
            titulo="Actualizar catálogo de proveedores",
            descripcion="Actualizar información de contacto de proveedores",
            fecha_vencimiento=date.today() + timedelta(days=7),
            prioridad="media",
            estado="en_progreso",
            user_id=usuarios[1].id,
        ),
        Tarea(
            titulo="Inventario mensual",
            descripcion="Realizar inventario de artículos en stock",
            fecha_vencimiento=date.today() + timedelta(days=14),
            prioridad="baja",
            estado="pendiente",
            user_id=usuarios[2].id,
        ),
    ]
    
    for tarea in tareas:
        session.add(tarea)
        print(f"   ✅ Tarea creada: {tarea.titulo}")
    
    session.commit()
    return tareas

def main():
    """Función principal"""
    print("="*60)
    print("🌱 SCRIPT DE DATOS DE PRUEBA PARA NEON")
    print("="*60)
    
    with Session(engine) as session:
        # Crear/verificar catálogos básicos
        if not crear_catalogos_basicos(session):
            print("\n❌ Error: No se pudieron crear los datos de catálogo básicos")
            print("   Ejecuta las migraciones: alembic upgrade head")
            return
        
        # Preguntar si limpiar datos
        # limpiar = input("\n¿Limpiar datos existentes? (s/N): ").lower() == 's'
        # if limpiar:
        #     limpiar_datos()
        
        # Crear datos en orden de dependencias
        usuarios = crear_usuarios(session)
        propiedades = crear_propiedades(session)
        proveedores = crear_proveedores(session)
        articulos = crear_articulos(session, proveedores)
        # facturas = crear_facturas(session, usuarios, proveedores, propiedades)
        # solicitudes = crear_solicitudes(session, usuarios, articulos)
        tareas = crear_tareas(session, usuarios)
        
        # Por ahora omitimos facturas y solicitudes por complejidad
        facturas = []
        solicitudes = []
        
        print("\n" + "="*60)
        print("✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE")
        print("="*60)
        print(f"\n📊 Resumen:")
        print(f"   👥 Usuarios: {len(usuarios)}")
        print(f"   🏠 Propiedades: {len(propiedades)}")
        print(f"   🏢 Proveedores: {len(proveedores)}")
        print(f"   📦 Artículos: {len(articulos)}")
        print(f"   🧾 Facturas: {len(facturas)}")
        print(f"   📝 Solicitudes: {len(solicitudes)}")
        print(f"   ✅ Tareas: {len(tareas)}")
        print("\n🎯 Ahora puedes probar los endpoints!")

if __name__ == "__main__":
    main()
