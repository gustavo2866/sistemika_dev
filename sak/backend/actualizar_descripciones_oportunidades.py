import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_oportunidad import CRMOportunidad
import random

def actualizar_descripciones():
    # Descripciones coherentes por tipo de operación
    descripciones_por_tipo = {
        'alquiler': [
            "Búsqueda de departamento amueblado para mudanza urgente por traslado laboral",
            "Alquiler temporal de oficina comercial en zona céntrica con buena conectividad",
            "Familia busca casa en alquiler con jardín y 3 dormitorios en barrio tranquilo",
            "Necesita local comercial en zona de alto tránsito para nuevo emprendimiento gastronómico",
            "Estudiante universitario busca monoambiente económico cerca del campus principal",
            "Empresa multinacional requiere oficinas corporativas para equipo de 20 personas",
            "Alquiler de bodega para almacenamiento de mercadería con acceso de carga",
            "Pareja joven busca departamento de 2 ambientes en zona residencial segura",
            "Profesional independiente necesita espacio para consultorio médico equipado",
            "Búsqueda de casa de campo para alquiler de fin de semana y vacaciones",
            "Local comercial en galería céntrica para apertura de boutique de ropa",
            "Departamento tipo loft para alquiler temporal de 6 meses por proyecto laboral",
            "Familia con mascotas busca casa con patio amplio en zona pet-friendly",
            "Oficina virtual con servicios incluidos para startup tecnológica en crecimiento",
            "Alquiler de penthouse amueblado en zona exclusiva para ejecutivo extranjero"
        ],
        'venta': [
            "Compra de primera vivienda para familia con presupuesto ajustado y financiación",
            "Inversión en propiedad para renta a largo plazo con buena rentabilidad esperada",
            "Búsqueda de terreno urbano para construcción de vivienda familiar personalizada",
            "Compra de departamento nuevo en pozo con facilidades de pago extendidas",
            "Cliente busca casa quinta con amplio terreno para uso recreativo familiar",
            "Inversión en local comercial estratégico en zona de alto crecimiento comercial",
            "Compra de propiedad para mudanza por jubilación y cambio de ciudad",
            "Búsqueda de oficina corporativa para compra y sede permanente de empresa",
            "Adquisición de terreno comercial para desarrollo de proyecto inmobiliario futuro",
            "Compra de departamento de lujo en torre con amenities completos y seguridad",
            "Inversión en propiedad turística en zona costera con potencial de alquiler",
            "Cliente busca casa histórica en casco antiguo para restauración y vivienda",
            "Compra de bodega industrial con oficinas para traslado de planta productiva",
            "Búsqueda de PH con terraza amplia para vivir con espacio al aire libre",
            "Adquisición de campo productivo con riego para emprendimiento agropecuario"
        ],
        'emprendimiento': [
            "Consulta por preventa de torre residencial en pozo con vista panorámica privilegiada",
            "Interés en unidades de proyecto nuevo con financiación directa del desarrollador",
            "Reserva de departamento en complejo cerrado con amenities y espacios verdes",
            "Preventa de oficinas premium en edificio inteligente de última generación",
            "Consulta por lotes en barrio privado cerrado con infraestructura completa",
            "Interés en unidades de emprendimiento sustentable con certificación ecológica",
            "Reserva anticipada de local en nuevo centro comercial en zona estratégica",
            "Preventa de departamentos tipo monoambiente para inversión y renta garantizada",
            "Consulta por townhouses en desarrollo horizontal con diseño contemporáneo",
            "Interés en cocheras y bauleras adicionales en torre residencial en construcción",
            "Reserva de penthouse con amenities exclusivos y financiación en pesos",
            "Preventa de oficinas corporativas con entrega inmediata y carpeta lista",
            "Consulta por dúplex en complejo con club house y seguridad 24 horas",
            "Interés en unidades funcionales de proyecto sustentable con paneles solares",
            "Reserva de departamentos con balcón terraza y parrilla en nuevo desarrollo"
        ]
    }
    
    descripciones_sin_tipo = [
        "Cliente interesado en opciones disponibles dentro de su presupuesto familiar",
        "Seguimiento de consulta inicial realizada a través del sitio web institucional",
        "Prospecto calificado evaluando múltiples alternativas en diferentes barrios",
        "Contacto referido por cliente satisfecho con operación anterior exitosa",
        "Consulta general sobre propiedades disponibles en la zona norte de la ciudad",
        "Cliente solicita información actualizada sobre el estado del mercado inmobiliario",
        "Seguimiento a visita presencial realizada en oficina comercial la semana anterior",
        "Prospecto con necesidad urgente de mudanza por motivos laborales inesperados",
        "Cliente evaluando opciones de inversión inmobiliaria a mediano plazo",
        "Consulta por propiedades en diferentes ubicaciones según preferencias personales",
        "Seguimiento a interés manifestado en múltiples publicaciones del portal web",
        "Cliente solicita asesoramiento profesional para decisión de compra importante",
        "Contacto generado por campaña de marketing digital en redes sociales",
        "Prospecto comparando ofertas entre diferentes agencias inmobiliarias locales",
        "Consulta inicial requiere seguimiento para definir criterios de búsqueda exactos"
    ]
    
    with Session(engine) as session:
        statement = select(CRMOportunidad).order_by(CRMOportunidad.id)
        oportunidades = session.exec(statement).all()
        
        print(f"Total de oportunidades: {len(oportunidades)}\n")
        
        actualizadas = 0
        por_tipo = {}
        
        for oport in oportunidades:
            tipo_codigo = None
            if oport.tipo_operacion_id:
                # Cargar la relación para obtener el código
                if oport.tipo_operacion:
                    tipo_codigo = oport.tipo_operacion.codigo
            
            # Seleccionar descripción coherente
            if tipo_codigo and tipo_codigo in descripciones_por_tipo:
                descripciones = descripciones_por_tipo[tipo_codigo]
                nueva_desc = random.choice(descripciones)
                tipo_key = tipo_codigo
            else:
                nueva_desc = random.choice(descripciones_sin_tipo)
                tipo_key = 'sin_tipo'
            
            oport.descripcion = nueva_desc
            actualizadas += 1
            
            # Contabilizar
            if tipo_key not in por_tipo:
                por_tipo[tipo_key] = 0
            por_tipo[tipo_key] += 1
        
        session.commit()
        
        print(f"✅ {actualizadas} oportunidades actualizadas\n")
        print("Distribución por tipo:")
        for tipo, count in sorted(por_tipo.items()):
            print(f"  {tipo}: {count}")

if __name__ == "__main__":
    actualizar_descripciones()
