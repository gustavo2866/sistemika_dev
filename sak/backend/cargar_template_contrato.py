"""
Carga el template de contrato de alquiler residencial argentino (Ley 27.551)
en el campo `template` del TipoContrato con id=1 (o el primero activo).

Uso:
    python cargar_template_contrato.py [tipo_contrato_id]
"""
import json
import sys

# Template basado en la Ley 27.551 de Alquileres de Argentina
TEMPLATE_ALQUILER_RESIDENCIAL = {
    "titulo": "CONTRATO DE LOCACIÓN HABITACIONAL",
    "subtitulo": "Ley N° 27.551 — República Argentina",
    "lugar_y_fecha": "En la ciudad de {{ ciudad }}, Provincia de {{ provincia }}, a los {{ fecha_dia }} días del mes de {{ fecha_mes }} del año {{ fecha_anio }}, entre las partes que a continuación se identifican, se celebra el siguiente contrato de locación habitacional:",

    "clausulas": [
        {
            "numero": "PRIMERA",
            "titulo": "PARTES",
            "cuerpo": (
                "LOCADOR: {{ propiedad_propietario }}, DNI/CUIT N° {{ propietario_cuit }}, "
                "con domicilio en {{ propietario_domicilio }}, "
                "en adelante denominado/a \"el Locador\".\n\n"
                "LOCATARIO: {{ inquilino_nombre_completo }}, DNI N° {{ inquilino_dni }}, "
                "CUIT/CUIL N° {{ inquilino_cuit }}, "
                "con domicilio en {{ inquilino_domicilio }}, "
                "correo electrónico {{ inquilino_email }}, teléfono {{ inquilino_telefono }}, "
                "en adelante denominado/a \"el Locatario\"."
            ),
        },
        {
            "numero": "SEGUNDA",
            "titulo": "OBJETO",
            "cuerpo": (
                "El Locador da en locación al Locatario el inmueble denominado \"{{ propiedad_nombre }}\", "
                "ubicado en {{ propiedad_domicilio }}, {{ propiedad_localidad }}, Provincia de {{ propiedad_provincia }}, "
                "Código Postal {{ propiedad_cp }}, con una superficie de {{ propiedad_metros }} m², "
                "compuesto por {{ propiedad_ambientes }} ambientes, "
                "Matrícula/Partida catastral: {{ propiedad_matricula }}. "
                "En adelante denominado \"el inmueble\", para ser destinado exclusivamente a uso habitacional, "
                "conforme lo establece el artículo 1194 del Código Civil y Comercial de la Nación."
            ),
        },
        {
            "numero": "TERCERA",
            "titulo": "DESTINO",
            "cuerpo": (
                "El Locatario se compromete a destinar el inmueble exclusivamente a vivienda particular y familiar, "
                "quedando expresamente prohibido su uso comercial, industrial o cualquier otro que no sea el habitacional "
                "pactado. Asimismo queda prohibida la sublocación total o parcial sin consentimiento escrito del Locador."
            ),
        },
        {
            "numero": "CUARTA",
            "titulo": "PLAZO",
            "cuerpo": (
                "La presente locación se pacta por el plazo de {{ duracion_meses }} meses ({{ duracion_anios }} años), "
                "con vigencia desde el día {{ fecha_inicio }} hasta el día {{ fecha_vencimiento }}, "
                "de conformidad con lo establecido en el artículo 1198 del Código Civil y Comercial de la Nación, "
                "que establece un plazo mínimo de locación de tres (3) años para inmuebles con destino habitacional.\n\n"
                "Vencido el plazo contractual, si el Locatario continuara en el uso y goce del inmueble y el Locador no "
                "solicitara la restitución, se operará la tácita reconducción conforme las disposiciones del artículo 1218 "
                "del Código Civil y Comercial de la Nación."
            ),
        },
        {
            "numero": "QUINTA",
            "titulo": "PRECIO Y FORMA DE PAGO",
            "cuerpo": (
                "El precio mensual de la locación se pacta en la suma de {{ valor_alquiler }} ({{ moneda }}), "
                "pagadero por mes adelantado dentro de los primeros cinco (5) días hábiles de cada mes, "
                "en el domicilio del Locador o mediante transferencia bancaria a la cuenta que éste indique.\n\n"
                "Queda expresamente prohibido el pago anticipado por períodos mayores a un (1) mes, conforme lo dispuesto "
                "en el artículo 1196 del Código Civil y Comercial de la Nación."
            ),
        },
        {
            "numero": "SEXTA",
            "titulo": "ACTUALIZACIÓN DEL PRECIO",
            "cuerpo": (
                "El precio de la locación se actualizará anualmente conforme al índice {{ tipo_actualizacion }}, "
                "de acuerdo a lo establecido en el artículo 14 de la Ley N° 27.551. "
                "La actualización se aplicará en cada aniversario de la firma del presente contrato.\n\n"
                "Queda expresamente prohibida la actualización o indexación de la renta locativa mediante el uso de "
                "índices o mecanismos distintos al establecido en la presente cláusula."
            ),
        },
        {
            "numero": "SÉPTIMA",
            "titulo": "DEPÓSITO EN GARANTÍA",
            "cuerpo": (
                "En concepto de depósito en garantía, el Locatario entrega en este acto al Locador la suma de "
                "{{ deposito_garantia }}, equivalente a un (1) mes de alquiler, conforme lo establecido en el artículo "
                "1996 del Código Civil y Comercial de la Nación.\n\n"
                "Dicho depósito será devuelto al Locatario dentro del plazo de un (1) mes desde la restitución del "
                "inmueble, con el ajuste correspondiente al último alquiler abonado. No podrá ser imputado por el "
                "Locatario al pago de alquileres."
            ),
        },
        {
            "numero": "OCTAVA",
            "titulo": "EXPENSAS, SERVICIOS Y CARGAS",
            "cuerpo": (
                "El pago de los servicios (electricidad, gas, agua, internet, teléfono) y las expensas ordinarias "
                "estará a cargo del Locatario desde la fecha de inicio del contrato hasta su fecha de vencimiento. "
                "Las expensas extraordinarias y las cargas y contribuciones que graven el inmueble estarán a cargo "
                "del Locador.\n\n"
                "El monto mensual de expensas ordinarias estimado es de {{ expensas }} ({{ moneda }})."
            ),
        },
        {
            "numero": "NOVENA",
            "titulo": "ESTADO DEL INMUEBLE",
            "cuerpo": (
                "El Locatario declara recibir el inmueble en perfectas condiciones de uso y habitabilidad, "
                "comprometiéndose a conservarlo en el mismo estado durante toda la vigencia del contrato y a "
                "restituirlo en igual condición al momento de la terminación de la locación, salvo el deterioro "
                "proveniente del uso normal y ordinario.\n\n"
                "Cualquier mejora, transformación o modificación que el Locatario desee realizar deberá contar con "
                "la autorización escrita previa del Locador."
            ),
        },
        {
            "numero": "DÉCIMA",
            "titulo": "RESCISIÓN ANTICIPADA",
            "cuerpo": (
                "El Locatario podrá, transcurridos los primeros seis (6) meses de vigencia del presente contrato, "
                "ejercer la opción de rescisión anticipada, debiendo notificar al Locador mediante carta documento "
                "con una anticipación mínima de sesenta (60) días corridos, conforme lo dispuesto en el artículo "
                "1221 del Código Civil y Comercial de la Nación.\n\n"
                "Si la rescisión se produce antes de cumplidos los primeros doce (12) meses del contrato, "
                "se deberá abonar al Locador una indemnización equivalente a un mes y medio (1,5) de alquiler vigente. "
                "Si se produce luego de los primeros doce (12) meses, la indemnización será equivalente a un (1) mes "
                "de alquiler vigente."
            ),
        },
        {
            "numero": "UNDÉCIMA",
            "titulo": "GARANTÍAS",
            "cuerpo": (
                "En carácter de fianza y garantía del fiel cumplimiento de todas las obligaciones emergentes del "
                "presente contrato, actúa como garante: {{ garante1_nombre_completo }}, DNI N° {{ garante1_dni }}, "
                "CUIT/CUIL N° {{ garante1_cuit }}, "
                "con domicilio en {{ garante1_domicilio }}, quien se constituye en liso y llano pagador y principal "
                "pagador, renunciando al beneficio de excusión, división y los demás que le otorga la ley. "
                "Tipo de garantía: {{ garante1_tipo_garantia }}."
            ),
        },
        {
            "numero": "DUODÉCIMA",
            "titulo": "DOMICILIOS",
            "cuerpo": (
                "Las partes constituyen domicilios especiales a los efectos del presente contrato:\n\n"
                "El Locador ({{ propiedad_propietario }}): {{ propietario_domicilio }}."
                " Correo electrónico: {{ propietario_email }}. Teléfono: {{ propietario_telefono }}.\n\n"
                "El Locatario: {{ inquilino_domicilio }}."
                " Correo electrónico: {{ inquilino_email }}. Teléfono: {{ inquilino_telefono }}.\n\n"
                "El Garante: {{ garante1_domicilio }}.\n\n"
                "En los domicilios consignados serán válidas todas las notificaciones judiciales y extrajudiciales "
                "que se efectúen en relación a la presente contratación."
            ),
        },
        {
            "numero": "DÉCIMOTERCERA",
            "titulo": "JURISDICCIÓN Y LEY APLICABLE",
            "cuerpo": (
                "Para todos los efectos legales y judiciales que pudieran derivarse del presente contrato, las partes "
                "se someten a la jurisdicción de los Tribunales Ordinarios de {{ ciudad }}, Provincia de {{ provincia }}, "
                "renunciando a cualquier otro fuero o jurisdicción que pudiera corresponderles.\n\n"
                "El presente contrato se regirá por las disposiciones de la Ley N° 27.551, el Código Civil y Comercial "
                "de la Nación, y demás normas aplicables."
            ),
        },
        {
            "numero": "DÉCIMOCUARTA",
            "titulo": "OBSERVACIONES",
            "cuerpo": "{{ observaciones }}",
        },
    ],

    "cierre": (
        "En prueba de conformidad con todo lo expuesto, las partes firman el presente contrato "
        "en dos (2) ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha indicados al comienzo."
    ),
}


def main():
    import sys
    import os
    sys.path.insert(0, os.path.dirname(__file__))

    from app.db import get_session
    from app.models.tipo_contrato import TipoContrato
    from sqlmodel import select

    tc_id = int(sys.argv[1]) if len(sys.argv) > 1 else None

    with next(get_session()) as session:
        if tc_id:
            tc = session.get(TipoContrato, tc_id)
            if not tc:
                print(f"ERROR: TipoContrato id={tc_id} no encontrado.")
                sys.exit(1)
        else:
            # Tomar el primero activo
            tc = session.exec(select(TipoContrato).where(TipoContrato.activo == True)).first()  # noqa: E712
            if not tc:
                print("ERROR: No hay tipos de contrato activos. Crea uno primero.")
                sys.exit(1)

        tc.template = TEMPLATE_ALQUILER_RESIDENCIAL
        session.add(tc)
        session.commit()
        session.refresh(tc)

        print(f"✅ Template cargado en TipoContrato id={tc.id} nombre='{tc.nombre}'")
        print(f"   Cláusulas: {len(TEMPLATE_ALQUILER_RESIDENCIAL['clausulas'])}")
        print(f"\nPara generar el PDF de un contrato:")
        print(f"  GET http://localhost:8000/contratos/{{id}}/pdf")


if __name__ == "__main__":
    main()
