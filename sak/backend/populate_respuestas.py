#!/usr/bin/env python3
"""
Script para poblar la tabla crm_catalogo_respuestas con respuestas estándares
usando acceso directo a la base de datos
"""
import sys
from sqlmodel import Session
from app.db import engine
from app.models.crm_catalogos import CRMCatalogoRespuesta

# Respuestas estándar para inmobiliaria
RESPUESTAS_ESTANDAR = [
    {
        "titulo": "Saludo inicial",
        "texto": "¡Hola! Gracias por tu interés en nuestras propiedades. Soy [NOMBRE], tu asesor inmobiliario. ¿En qué puedo ayudarte hoy? ¿Buscas comprar, vender o alquilar?",
        "activo": True
    },
    {
        "titulo": "Solicitar información del cliente",
        "texto": "Para poder ofrecerte las mejores opciones, me gustaría conocer un poco más sobre lo que buscas: ¿Qué tipo de propiedad te interesa? ¿En qué zona? ¿Cuál es tu presupuesto aproximado?",
        "activo": True
    },
    {
        "titulo": "Programar visita",
        "texto": "Excelente, tenemos varias opciones que podrían interesarte. ¿Te gustaría agendar una visita? Estoy disponible [DÍAS/HORARIOS]. También puedo enviarte más información y fotos por WhatsApp si prefieres.",
        "activo": True
    },
    {
        "titulo": "Seguimiento post visita",
        "texto": "Espero que hayas disfrutado la visita a la propiedad. ¿Qué te pareció? ¿Tienes alguna pregunta adicional o te gustaría ver otras opciones similares?",
        "activo": True
    },
    {
        "titulo": "Información sobre financiamiento",
        "texto": "Respecto al financiamiento, podemos ayudarte con diferentes opciones: crédito hipotecario, financiamiento directo con el desarrollador, o planes de pago flexibles. ¿Te interesa que te conecte con nuestro especialista financiero?",
        "activo": True
    }
]

def poblar_respuestas():
    """Poblar la tabla con respuestas estándares"""
    print("🏠 Poblando tabla CRM Catálogo Respuestas - Chat Inmobiliaria")
    print("="*60)
    
    with Session(engine) as session:
        try:
            # Verificar cuántas respuestas existen
            existing_count = len(session.query(CRMCatalogoRespuesta).all())
            print(f"📊 Respuestas existentes: {existing_count}")
            
            if existing_count > 0:
                print("⚠️ La tabla ya contiene respuestas.")
                respuesta = input("¿Deseas agregar las respuestas estándares de todas formas? (s/N): ")
                if respuesta.lower() not in ['s', 'si', 'sí', 'y', 'yes']:
                    print("❌ Operación cancelada.")
                    return
            
            # Crear respuestas estándar
            respuestas_creadas = []
            for i, respuesta_data in enumerate(RESPUESTAS_ESTANDAR, 1):
                print(f"➕ Creando respuesta {i}: {respuesta_data['titulo']}")
                
                respuesta = CRMCatalogoRespuesta(
                    titulo=respuesta_data['titulo'],
                    texto=respuesta_data['texto'],
                    activo=respuesta_data['activo']
                )
                
                session.add(respuesta)
                respuestas_creadas.append(respuesta)
            
            # Confirmar cambios
            session.commit()
            
            print(f"✅ {len(respuestas_creadas)} respuestas creadas exitosamente!")
            print("\n📋 Respuestas creadas:")
            
            # Mostrar las respuestas creadas
            for respuesta in respuestas_creadas:
                # Refresh para obtener el ID asignado
                session.refresh(respuesta)
                status = "🟢" if respuesta.activo else "🔴"
                print(f"  {status} ID:{respuesta.id} - {respuesta.titulo}")
                print(f"     📝 {respuesta.texto[:80]}{'...' if len(respuesta.texto) > 80 else ''}")
                print()
            
        except Exception as e:
            session.rollback()
            print(f"❌ Error al poblar respuestas: {e}")
            raise

def verificar_respuestas():
    """Verificar las respuestas existentes en la tabla"""
    print("🔍 Verificando respuestas existentes...")
    print("="*60)
    
    with Session(engine) as session:
        try:
            respuestas = session.query(CRMCatalogoRespuesta).all()
            
            if not respuestas:
                print("📋 No hay respuestas en la tabla")
                return
            
            print(f"📊 Total de respuestas: {len(respuestas)}")
            print("\n📋 Lista de respuestas:")
            
            for respuesta in respuestas:
                status = "🟢" if respuesta.activo else "🔴"
                print(f"  {status} ID:{respuesta.id} - {respuesta.titulo}")
                print(f"     📝 {respuesta.texto[:100]}{'...' if len(respuesta.texto) > 100 else ''}")
                print(f"     📅 Creado: {respuesta.created_at}")
                print()
                
        except Exception as e:
            print(f"❌ Error al verificar respuestas: {e}")

def main():
    """Función principal"""
    print("🏠 CRM CATÁLOGO RESPUESTAS - GESTIÓN DE DATOS")
    print("="*60)
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "verificar":
            verificar_respuestas()
        elif command == "poblar":
            poblar_respuestas()
        elif command == "help":
            print("Comandos disponibles:")
            print("  python populate_respuestas.py verificar  - Ver respuestas existentes")
            print("  python populate_respuestas.py poblar     - Agregar respuestas estándares")
            print("  python populate_respuestas.py help       - Mostrar esta ayuda")
        else:
            print(f"❌ Comando desconocido: {command}")
            print("Use 'help' para ver comandos disponibles")
    else:
        # Sin argumentos, mostrar menú interactivo
        while True:
            print("\n🎯 ¿Qué deseas hacer?")
            print("1. Verificar respuestas existentes")
            print("2. Poblar tabla con respuestas estándares")
            print("3. Salir")
            
            opcion = input("\nSelecciona una opción (1-3): ").strip()
            
            if opcion == "1":
                verificar_respuestas()
            elif opcion == "2":
                poblar_respuestas()
            elif opcion == "3":
                print("👋 ¡Hasta luego!")
                break
            else:
                print("❌ Opción inválida. Intenta nuevamente.")

if __name__ == "__main__":
    main()