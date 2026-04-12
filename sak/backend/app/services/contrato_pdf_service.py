"""
Servicio de generación de PDF para contratos de alquiler.

Usa el campo `template` del TipoContrato (JSONB) como plantilla Jinja2,
reemplazando variables con los datos del Contrato, e imprime con ReportLab.

Estructura esperada del template JSON:
{
    "titulo": "...",
    "subtitulo": "...",
    "lugar_y_fecha": "En la ciudad de {{ciudad}}, a los {{fecha_dia}} días...",
    "clausulas": [
        {"numero": "PRIMERA", "titulo": "OBJETO", "cuerpo": "texto con {{vars}}"},
        ...
    ],
    "cierre": "En prueba de conformidad..."
}
"""

from __future__ import annotations

import io
import unicodedata
from datetime import date
from typing import Any, Dict, Optional

from jinja2 import Environment, StrictUndefined, UndefinedError
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Constantes ────────────────────────────────────────────────────────────────

MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

MONEDA_SIMBOLO: Dict[str, str] = {
    "ARS": "$",
    "USD": "U$S",
    "EUR": "€",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_fecha(d: Optional[date]) -> str:
    if not d:
        return "—"
    return f"{d.day} de {MESES_ES[d.month - 1]} de {d.year}"


def _fmt_monto(valor: Optional[float], moneda: str = "ARS") -> str:
    if valor is None:
        return "—"
    simbolo = MONEDA_SIMBOLO.get(moneda, moneda)
    return f"{simbolo} {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _nombre_completo(nombre: Optional[str], apellido: Optional[str]) -> str:
    partes = [x for x in [nombre, apellido] if x]
    return " ".join(partes) if partes else "—"


def _safe(value: Optional[str], fallback: str = "—") -> str:
    if value is None or str(value).strip() == "":
        return fallback
    return value


# ── Contexto del contrato ─────────────────────────────────────────────────────

def build_context(contrato: Any) -> Dict[str, Any]:
    """Construye el diccionario de variables para el template Jinja2."""
    propiedad = getattr(contrato, "propiedad", None)
    tipo_contrato = getattr(contrato, "tipo_contrato", None)
    tipo_actualizacion = getattr(contrato, "tipo_actualizacion", None)

    fecha_inicio: Optional[date] = getattr(contrato, "fecha_inicio", None)
    fecha_venc: Optional[date] = getattr(contrato, "fecha_vencimiento", None)
    duracion = getattr(contrato, "duracion_meses", None)
    if duracion is None and fecha_inicio and fecha_venc:
        duracion = (fecha_venc.year - fecha_inicio.year) * 12 + (fecha_venc.month - fecha_inicio.month)

    hoy = date.today()

    return {
        # Fechas
        "fecha_dia": str(hoy.day),
        "fecha_mes": MESES_ES[hoy.month - 1],
        "fecha_anio": str(hoy.year),
        "fecha_inicio": _fmt_fecha(fecha_inicio),
        "fecha_vencimiento": _fmt_fecha(fecha_venc),
        "duracion_meses": str(duracion or "—"),
        "duracion_anios": str(round((duracion or 0) / 12, 1)) if duracion else "—",

        # Propiedad
        "propiedad_nombre": _safe(getattr(propiedad, "nombre", None)) if propiedad else "—",
        "propiedad_domicilio": _safe(getattr(propiedad, "domicilio", None)) if propiedad else "—",
        "propiedad_localidad": _safe(getattr(propiedad, "localidad", None)) if propiedad else "—",
        "propiedad_provincia": _safe(getattr(propiedad, "provincia", None)) if propiedad else "—",
        "propiedad_cp": _safe(getattr(propiedad, "codigo_postal", None)) if propiedad else "—",
        "propiedad_matricula": _safe(getattr(propiedad, "matricula_catastral", None)) if propiedad else "—",
        "propiedad_metros": str(getattr(propiedad, "metros_cuadrados", None) or "—"),
        "propiedad_ambientes": str(getattr(propiedad, "ambientes", None) or "—"),

        # Propietario (desde relación propietario_ref si existe, sino desde campo string)
        "propiedad_propietario": (
            _safe(getattr(propiedad.propietario_ref, "nombre", None))
            if propiedad and getattr(propiedad, "propietario_ref", None)
            else _safe(getattr(propiedad, "propietario", None)) if propiedad else "—"
        ),
        "propietario_dni": (
            _safe(getattr(propiedad.propietario_ref, "dni", None))
            if propiedad and getattr(propiedad, "propietario_ref", None) else "—"
        ),
        "propietario_cuit": (
            _safe(getattr(propiedad.propietario_ref, "cuit", None))
            if propiedad and getattr(propiedad, "propietario_ref", None) else "—"
        ),
        "propietario_domicilio": (
            _safe(getattr(propiedad.propietario_ref, "domicilio", None))
            if propiedad and getattr(propiedad, "propietario_ref", None) else "—"
        ),
        "propietario_email": (
            _safe(getattr(propiedad.propietario_ref, "email", None))
            if propiedad and getattr(propiedad, "propietario_ref", None) else "—"
        ),
        "propietario_telefono": (
            _safe(getattr(propiedad.propietario_ref, "telefono", None))
            if propiedad and getattr(propiedad, "propietario_ref", None) else "—"
        ),

        # Tipo contrato
        "tipo_contrato_nombre": _safe(getattr(tipo_contrato, "nombre", None)) if tipo_contrato else "—",

        # Inquilino
        "inquilino_nombre_completo": _nombre_completo(
            getattr(contrato, "inquilino_nombre", None),
            getattr(contrato, "inquilino_apellido", None),
        ),
        "inquilino_nombre": _safe(getattr(contrato, "inquilino_nombre", None)),
        "inquilino_apellido": _safe(getattr(contrato, "inquilino_apellido", None)),
        "inquilino_dni": _safe(getattr(contrato, "inquilino_dni", None)),
        "inquilino_cuit": _safe(getattr(contrato, "inquilino_cuit", None)),
        "inquilino_email": _safe(getattr(contrato, "inquilino_email", None)),
        "inquilino_telefono": _safe(getattr(contrato, "inquilino_telefono", None)),
        "inquilino_domicilio": _safe(getattr(contrato, "inquilino_domicilio", None)),

        # Garante 1
        "garante1_nombre_completo": _nombre_completo(
            getattr(contrato, "garante1_nombre", None),
            getattr(contrato, "garante1_apellido", None),
        ),
        "garante1_dni": _safe(getattr(contrato, "garante1_dni", None)),
        "garante1_cuit": _safe(getattr(contrato, "garante1_cuit", None)),
        "garante1_domicilio": _safe(getattr(contrato, "garante1_domicilio", None)),
        "garante1_tipo_garantia": _safe(getattr(contrato, "garante1_tipo_garantia", None)),

        # Garante 2
        "garante2_nombre_completo": _nombre_completo(
            getattr(contrato, "garante2_nombre", None),
            getattr(contrato, "garante2_apellido", None),
        ),
        "garante2_dni": _safe(getattr(contrato, "garante2_dni", None)),
        "garante2_cuit": _safe(getattr(contrato, "garante2_cuit", None)),
        "garante2_domicilio": _safe(getattr(contrato, "garante2_domicilio", None)),
        "garante2_tipo_garantia": _safe(getattr(contrato, "garante2_tipo_garantia", None)),

        # Economía
        "moneda": _safe(getattr(contrato, "moneda", "ARS")),
        "valor_alquiler": _fmt_monto(getattr(contrato, "valor_alquiler", None), getattr(contrato, "moneda", "ARS")),
        "valor_alquiler_num": str(getattr(contrato, "valor_alquiler", "—") or "—"),
        "expensas": _fmt_monto(getattr(contrato, "expensas", None), getattr(contrato, "moneda", "ARS")),
        "deposito_garantia": _fmt_monto(getattr(contrato, "deposito_garantia", None), getattr(contrato, "moneda", "ARS")),
        "tipo_actualizacion": _safe(getattr(tipo_actualizacion, "nombre", None)) if tipo_actualizacion else "ICL (Índice de Contratos de Locación) — Banco Central de la República Argentina",

        # Misc — ciudad se toma del lugar_celebracion del contrato; si no está,
        # cae a la localidad de la propiedad; si tampoco, al default configurado.
        "ciudad": (
            _safe(getattr(contrato, "lugar_celebracion", None))
            if getattr(contrato, "lugar_celebracion", None)
            else (
                _safe(getattr(propiedad, "localidad", None))
                if propiedad and getattr(propiedad, "localidad", None)
                else "San Miguel de Tucumán"
            )
        ),
        "provincia": (
            _safe(getattr(propiedad, "provincia", None))
            if propiedad and getattr(propiedad, "provincia", None)
            else "Tucumán"
        ),
        "observaciones": _safe(getattr(contrato, "observaciones", None)),
        "contrato_id": str(getattr(contrato, "id", "—")),
    }


def _render(text: str, ctx: Dict[str, Any]) -> str:
    """Renderiza un string con Jinja2, ignorando variables no definidas."""
    env = Environment(loader=None, undefined=StrictUndefined)
    try:
        return env.from_string(text).render(**ctx)
    except UndefinedError:
        # Fallback: render con undefined permisive
        from jinja2 import Undefined
        env2 = Environment(loader=None)
        return env2.from_string(text).render(**ctx)


# ── Estilos ReportLab ─────────────────────────────────────────────────────────

def _build_styles() -> Dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()

    titulo = ParagraphStyle(
        "ContratoTitulo",
        parent=base["Heading1"],
        fontSize=14,
        leading=18,
        alignment=1,  # centrado
        spaceAfter=4,
        textColor=colors.HexColor("#1a1a2e"),
    )
    subtitulo = ParagraphStyle(
        "ContratoSubtitulo",
        parent=base["Normal"],
        fontSize=10,
        leading=14,
        alignment=1,
        spaceAfter=2,
        textColor=colors.HexColor("#555555"),
    )
    lugar_fecha = ParagraphStyle(
        "LugarFecha",
        parent=base["Normal"],
        fontSize=10,
        leading=14,
        alignment=1,
        spaceAfter=12,
        textColor=colors.HexColor("#333333"),
    )
    clausula_titulo = ParagraphStyle(
        "ClausulaTitulo",
        parent=base["Heading2"],
        fontSize=10,
        leading=14,
        spaceBefore=10,
        spaceAfter=3,
        textColor=colors.HexColor("#1a1a2e"),
    )
    clausula_cuerpo = ParagraphStyle(
        "ClausulaCuerpo",
        parent=base["Normal"],
        fontSize=9,
        leading=14,
        spaceBefore=0,
        spaceAfter=6,
        textColor=colors.HexColor("#222222"),
        alignment=4,  # justified
    )
    firma_label = ParagraphStyle(
        "FirmaLabel",
        parent=base["Normal"],
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor("#555555"),
    )
    cierre = ParagraphStyle(
        "Cierre",
        parent=base["Normal"],
        fontSize=9,
        leading=14,
        spaceBefore=16,
        spaceAfter=8,
        alignment=4,
        textColor=colors.HexColor("#222222"),
    )

    return {
        "titulo": titulo,
        "subtitulo": subtitulo,
        "lugar_fecha": lugar_fecha,
        "clausula_titulo": clausula_titulo,
        "clausula_cuerpo": clausula_cuerpo,
        "firma_label": firma_label,
        "cierre": cierre,
    }


# ── Bloque de firma ───────────────────────────────────────────────────────────

def _firma_block(label: str, styles: Dict[str, ParagraphStyle]):
    """Retorna una tabla con línea de firma y label."""
    line_style = TableStyle([
        ("LINEABOVE", (0, 0), (0, 0), 1, colors.HexColor("#555555")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ])
    t = Table(
        [[Paragraph(label, styles["firma_label"])]],
        colWidths=[6 * cm],
        style=line_style,
    )
    return t


# ── PDF builder ───────────────────────────────────────────────────────────────

def build_contrato_pdf(contrato: Any, template: Dict[str, Any]) -> bytes:
    """
    Genera el PDF del contrato a partir del objeto Contrato y el template JSON.
    Retorna los bytes del PDF generado.
    """
    ctx = build_context(contrato)
    styles = _build_styles()
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title=_render(template.get("titulo", "Contrato"), ctx),
    )

    elements = []

    # ── Encabezado ──
    titulo = _render(template.get("titulo", "CONTRATO DE LOCACIÓN"), ctx)
    elements.append(Paragraph(titulo, styles["titulo"]))

    subtitulo = template.get("subtitulo", "")
    if subtitulo:
        elements.append(Paragraph(_render(subtitulo, ctx), styles["subtitulo"]))

    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1a1a2e"), spaceAfter=8))

    lugar_fecha = template.get("lugar_y_fecha", "")
    if lugar_fecha:
        elements.append(Paragraph(_render(lugar_fecha, ctx), styles["lugar_fecha"]))

    # ── Cláusulas ──
    for clausula in template.get("clausulas", []):
        numero = clausula.get("numero", "")
        titulo_clausula = clausula.get("titulo", "")
        cuerpo = clausula.get("cuerpo", "")

        heading = f"{numero} — {titulo_clausula}" if titulo_clausula else numero
        elements.append(Paragraph(heading, styles["clausula_titulo"]))

        if cuerpo:
            rendered_cuerpo = _render(cuerpo, ctx)
            # Dividir en párrafos si hay \n\n
            for parr in rendered_cuerpo.split("\n\n"):
                parr = parr.strip()
                if parr:
                    elements.append(Paragraph(parr.replace("\n", "<br/>"), styles["clausula_cuerpo"]))

    # ── Cierre ──
    cierre_texto = template.get("cierre", "En prueba de conformidad, las partes firman el presente contrato en dos (2) ejemplares de un mismo tenor y a un solo efecto, en el lugar y fecha indicados.")
    elements.append(Paragraph(_render(cierre_texto, ctx), styles["cierre"]))

    elements.append(Spacer(1, 1.5 * cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=16))

    # ── Firmas ──
    inquilino_nc = ctx.get("inquilino_nombre_completo", "Inquilino")
    garante1_nc = ctx.get("garante1_nombre_completo", "")
    propietario = ctx.get("propiedad_propietario", "Locador")

    bloques = [
        _firma_block(f"LOCADOR\n{propietario}", styles),
        _firma_block(f"LOCATARIO\n{inquilino_nc}", styles),
    ]
    if garante1_nc and garante1_nc != "—":
        bloques.append(_firma_block(f"GARANTE 1\n{garante1_nc}", styles))
        garante2_nc = ctx.get("garante2_nombre_completo", "")
        if garante2_nc and garante2_nc != "—":
            bloques.append(_firma_block(f"GARANTE 2\n{garante2_nc}", styles))

    # Distribuir firmas en fila de 2 o 3
    paso = 2 if len(bloques) <= 2 else 3
    for i in range(0, len(bloques), paso):
        fila = bloques[i : i + paso]
        col_w = (doc.width / paso)
        t = Table(
            [fila],
            colWidths=[col_w] * len(fila),
            rowHeights=[2.5 * cm],
        )
        t.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 0.5 * cm))

    doc.build(elements)
    return buf.getvalue()
