import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from app.db import engine
from app.models.crm_evento import CRMEvento

# Datos de eventos con título corto y descripción detallada
EVENTOS_DATA = [
    {
        "tipo": "llamada",
        "titulo": "Primera consulta cliente",
        "descripcion": "Cliente llamó para consultar sobre las propiedades disponibles en el barrio Los Robles. Mostró especial interés en departamentos de 2 dormitorios con balcón. Mencionó que su presupuesto es de USD 120,000 y que necesita financiamiento. Le comenté sobre nuestras opciones disponibles y quedó en que lo contactaría nuevamente esta semana para agendar una visita."
    },
    {
        "tipo": "reunion",
        "titulo": "Presentación de opciones",
        "descripcion": "Reunión en oficina con el matrimonio Fernández. Presentamos 3 opciones de departamentos que se ajustan a sus necesidades: 2 dormitorios, cerca de escuelas y con buena conectividad. Mostraron mayor interés en la unidad 4B del edificio Mirador. Solicitaron ver el departamento físicamente y preguntaron sobre los tiempos de escrituración."
    },
    {
        "tipo": "visita",
        "titulo": "Recorrido propiedad con cliente",
        "descripcion": "Realizamos visita a la propiedad ubicada en Av. Libertador 2350, 4B. El cliente quedó muy impresionado con la vista, la luminosidad y la distribución de ambientes. Preguntó específicamente sobre gastos comunes (aprox $35,000/mes) y servicios incluidos. Su esposa destacó la cocina integrada y el lavadero independiente. Pidieron tiempo para evaluar con su asesor financiero."
    },
    {
        "tipo": "email",
        "titulo": "Envío de documentación",
        "descripcion": "Envié por email toda la documentación solicitada: plantas del departamento, especificaciones técnicas, reglamento de copropiedad, y detalle de expensas de los últimos 6 meses. Incluí también el listado de terminaciones premium y dos alternativas de financiamiento bancario con tasas preferenciales. Cliente confirmó recepción y comentó que lo revisará con su contador."
    },
    {
        "tipo": "whatsapp",
        "titulo": "Confirmación de interés",
        "descripcion": "Cliente envió mensaje confirmando que la propiedad les gustó mucho y que definitivamente quieren avanzar. Mencionó que ya habló con el banco y tiene pre-aprobación del crédito hipotecario. Preguntó si el departamento sigue disponible y cuáles serían los próximos pasos. Le respondí que sí está disponible y que necesitamos formalizar una reserva con seña del 5%."
    },
    {
        "tipo": "nota",
        "titulo": "Seguimiento pendiente semana próxima",
        "descripcion": "Cliente pidió unos días más para coordinar con su familia. Están esperando que su hijo regrese del exterior para que vea la propiedad. Según conversación telefónica, el hijo llega el viernes próximo. Acordamos reagendar visita para el sábado 14/12 a las 10:00 hs. Enviar recordatorio el jueves por la tarde. Cliente muy comprometido, alta probabilidad de cierre."
    },
    {
        "tipo": "llamada",
        "titulo": "Consulta sobre financiamiento",
        "descripcion": "Llamada recibida donde el cliente consultó específicamente sobre opciones de financiamiento. Le expliqué las 3 alternativas disponibles: crédito hipotecario tradicional (75% financiado), crédito UVA (80% financiado), y plan de pago directo con desarrolladora en 24 cuotas. Mostró preferencia por el crédito UVA. Le pasé contacto de nuestro asesor financiero para que lo guíe en el proceso."
    },
    {
        "tipo": "reunion",
        "titulo": "Análisis de propuesta",
        "descripcion": "Reunión para analizar la propuesta económica del cliente. Ofrecieron USD 115,000 cuando el precio de lista es USD 125,000. Negociamos y llegamos a un acuerdo en USD 120,000 con inclusión de cochera. Cliente acepta dar seña de USD 6,000 (5%) y el saldo en 30 días hábiles. Quedamos en que su escribano preparará la minuta de reserva para revisión mutua."
    },
    {
        "tipo": "visita",
        "titulo": "Segunda visita con familia",
        "descripcion": "Visita programada con el grupo familiar completo (4 personas). Padres, hijo mayor y su pareja. Recorrimos nuevamente el departamento 4B y esta vez se enfocaron en detalles prácticos: medidas exactas de dormitorios, tipo de aberturas, orientación solar, estado de instalaciones. La nuera hizo varias preguntas sobre seguridad y amenities del edificio. Al finalizar, el grupo se mostró conforme y pidieron 48hs para decidir."
    },
    {
        "tipo": "email",
        "titulo": "Envío de minuta de reserva",
        "descripcion": "Remití por email la minuta de reserva elaborada por nuestro escribano. Documento incluye: identificación de partes, descripción de la propiedad, precio acordado (USD 120,000), forma de pago (seña 5%, saldo en 30 días), plazos para escrituración (90 días desde firma), cláusulas de rescisión, y datos bancarios para transferencia de seña. Cliente tiene plazo hasta el lunes para firmar y transferir."
    },
    {
        "tipo": "whatsapp",
        "titulo": "Confirmación de transferencia de seña",
        "descripcion": "Cliente envió comprobante de transferencia bancaria por USD 6,000 correspondiente a la seña. Adjuntó también la minuta firmada escaneada. Le confirmé recepción correcta y le comenté que el departamento queda reservado a su nombre por 30 días. Le recordé que el próximo paso es coordinar con su escribano para iniciar los trámites de escrituración. Muy conforme con el avance."
    },
    {
        "tipo": "nota",
        "titulo": "Preparar documentación para escritura",
        "descripcion": "Iniciar recopilación de documentación necesaria para escrituración: certificado de dominio actualizado, planos aprobados, libre deuda de expensas, certificado de deudas municipales, reglamento de copropiedad inscripto, y constancia de CUIT de la inmobiliaria. Coordinar con escribanía para fecha tentativa de firma. Cliente ya tiene turno en banco para gestionar desembolso del préstamo hipotecario."
    },
]

def actualizar_titulos_descripciones():
    with Session(engine) as session:
        statement = select(CRMEvento).order_by(CRMEvento.id)
        eventos = session.exec(statement).all()
        
        print(f"Total de eventos: {len(eventos)}\n")
        
        actualizados = 0
        for i, evento in enumerate(eventos):
            # Usar los datos predefinidos de manera cíclica
            datos = EVENTOS_DATA[i % len(EVENTOS_DATA)]
            
            evento.titulo = datos["titulo"]
            evento.descripcion = datos["descripcion"]
            
            print(f"Evento {evento.id}:")
            print(f"  Título: {evento.titulo}")
            print(f"  Descripción: {datos['descripcion'][:80]}...")
            print()
            
            actualizados += 1
        
        session.commit()
        print(f"✅ {actualizados} eventos actualizados con títulos y descripciones realistas")

if __name__ == "__main__":
    actualizar_titulos_descripciones()
