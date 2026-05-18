"""
Parseo directo de mensajes, sin LLM.

Devuelve resultado con confianza ALTA o BAJA.
ALTA: el nodo ejecuta directamente.
BAJA: el nodo escala al LLM.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal


# ---------------------------------------------------------------------------
# Patrones
# ---------------------------------------------------------------------------

_UNIDADES = (
    r"bolsas?", r"barras?", r"m3", r"m³", r"metros?\s*c[uú]bicos?",
    r"metros?\s*cuadrados?", r"m2", r"m²", r"metros?", r"mts?",
    r"unidades?", r"u", r"rollos?", r"kg", r"kilos?",
    r"toneladas?", r"tn", r"litros?", r"lts?", r"latas?", r"lta",
    r"cajones?", r"paquetes?", r"tablas?", r"palos?",
    r"chapas?", r"tubos?", r"ca[ñn]os?", r"varillas?",
    r"bidones?", r"baldes?", r"cubos?", r"sacas?",
)
_UNIDAD_RE = r"(?:" + "|".join(_UNIDADES) + r")"

_ITEM_RE = re.compile(
    r"(?P<cantidad>\d+(?:[.,]\d+)?)\s*"
    r"(?P<unidad>" + _UNIDAD_RE + r")?\s*"
    r"(?:de\s+)?(?P<descripcion>[a-záéíóúüñ][a-záéíóúüñ0-9\s\-\.\/ ]*?)"
    r"(?=\s*[,;]|\s+(?:y|e)\s+\d|\s*$)",
    re.IGNORECASE,
)

_CIERRE_RE = re.compile(
    r"\b(listo|eso\s+es\s+todo|cerr(?:ar|[aá])|finaliz(?:ar|[aá])|confirm(?:ar|[aá])|"
    r"termin(?:ar|[ée])|ya\s+est[aá]|nada\s+m[aá]s|no\s+hay\s+m[aá]s)\b",
    re.IGNORECASE,
)

_CMD_QUITAR_RE = re.compile(
    r"\b(quitar?|quit[aá]|sacar?|sac[aá]|borrar?|borr[aá]|eliminar?|elimin[aá]|remover?|remov[eé])\b",
    re.IGNORECASE,
)
_CMD_LIMPIAR_RE = re.compile(
    r"\b(limpiar|limpi[aá]|borrar\s+todo|borr[aá]\s+todo|"
    r"empezar\s+de\s+nuevo|empiez[aá]\s+de\s+nuevo|reiniciar|reinici[aá])\b",
    re.IGNORECASE,
)
_CMD_MOSTRAR_RE = re.compile(
    r"\b(mostrar?|mostr[aá]|ve[oó]|listar?|list[aá]|qu[eé]\s+ten[eé]s?|cu[aá]nto\s+llev[aá]s?)\b",
    re.IGNORECASE,
)
_CMD_MODIFICAR_RE = re.compile(
    r"\b(cambiar?|cambi[aá]|modificar?|modific[aá]|actualizar?|actualiz[aá]|"
    r"corregir?|corrig[eé]|poner?|pon[eé]|dejar?|dej[aá])\b",
    re.IGNORECASE,
)

_ARTICULOS_RE = re.compile(r"^\s*(?:los|las|unos|unas|el|la|un|una)\s+", re.IGNORECASE)

_CORRECCION_RE = re.compile(
    r"^[^.!?]*?\b(?:la|el|los|las)\s+"
    r"(?P<item>[a-záéíóúüñ][a-záéíóúüñ\s\-]{1,40}?)\s+"
    r"(?:era[n]?|son|es|eran|deb[eé](?:r[ií]a[n]?)?|qued[a]?)\s+"
    r"(?:de\s+)?(?P<cantidad>\d+(?:[.,]\d+)?)\s*"
    r"(?P<unidad>" + _UNIDAD_RE + r")?",
    re.IGNORECASE,
)

_MOD_DESCRIPCION_RE = re.compile(
    r"^\s*(?:el|la|los|las)?\s*"
    r"(?P<item>[a-záéíóúüñ][a-záéíóúüñ0-9\s\-]{1,45}?)\s+"
    r"(?:(?:debe[n]?|tiene[n]?)\s+que\s+ser|debe[n]?\s+ser|que\s+sea[n]?|son|es)\s+"
    r"(?P<detalle>[a-záéíóúüñ0-9][a-záéíóúüñ0-9\s\-\.\/]{1,60})\s*[.!]?\s*$",
    re.IGNORECASE,
)

_CONFIRMAR_RE = re.compile(
    r"^\s*(s[ií]|dale|ok|correcto|vamos?|claro|perfecto|confirm[ao]|confirm[aá]|"
    r"confir[mn]o|confirmar|confirm[eé]|yep|yes)\s*[.!]?\s*$",
    re.IGNORECASE,
)
_CANCELAR_RE = re.compile(
    r"^\s*(no|cancel[ao]|cancelar|cancel[aá]|olvid[ao]|olvidar|dej[aá]\s+de\s+lado)\s*[.!]?\s*$",
    re.IGNORECASE,
)

_NUMERO_RE = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?P<unidad>" + _UNIDAD_RE + r")?\s*$", re.IGNORECASE)

_REFERENCIA_RE = re.compile(
    r"\b(lo\s*mismo|igual|dem[aá]s|anterior|m[aá]s\s+de\s+eso|otro\s+tanto|"
    r"lo\s+de\s+siempre|lo\s+que\s+llevo|lo\s+que\s+hay)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Resultado del parser
# ---------------------------------------------------------------------------

Confidence = Literal["high", "low"]


@dataclass(slots=True)
class ParsedItem:
    descripcion: str
    cantidad: float | None
    unidad: str | None


@dataclass(slots=True)
class ParseResult:
    confidence: Confidence
    intent: Literal[
        "item",
        "comando_quitar",
        "comando_limpiar",
        "comando_mostrar",
        "comando_modificar",
        "cierre",
        "confirmar",
        "cancelar",
        "cantidad",
        "unknown",
    ] = "unknown"
    items: list[ParsedItem] = field(default_factory=list)
    cantidad_valor: float | None = None
    unidad_valor: str | None = None
    target_descripcion: str | None = None
    nueva_descripcion: str | None = None
    raw_text: str = ""

    @property
    def is_high_confidence(self) -> bool:
        return self.confidence == "high"


# ---------------------------------------------------------------------------
# Números en palabras
# ---------------------------------------------------------------------------

_NUMEROS_ES = {
    "un": "1", "uno": "1", "una": "1",
    "dos": "2",
    "tres": "3",
    "cuatro": "4",
    "cinco": "5",
    "seis": "6",
    "siete": "7",
    "ocho": "8",
    "nueve": "9",
    "diez": "10",
    "once": "11",
    "doce": "12",
    "trece": "13",
    "catorce": "14",
    "quince": "15",
    "veinte": "20",
    "treinta": "30",
    "cuarenta": "40",
    "cincuenta": "50",
    "cien": "100",
    "ciento": "100",
    "doscientos": "200", "doscientas": "200",
    "trescientos": "300", "trescientas": "300",
    "cuatrocientos": "400", "cuatrocientas": "400",
    "quinientos": "500", "quinientas": "500",
    "mil": "1000",
}
_NUMEROS_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(_NUMEROS_ES, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)


def _normalizar_numeros(text: str) -> str:
    return _NUMEROS_RE.sub(lambda m: _NUMEROS_ES[m.group(1).lower()], text)


# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------

def parse_message(text: str) -> ParseResult:
    t = _normalizar_numeros(text.strip())

    if not t:
        return ParseResult(confidence="low", intent="unknown", raw_text=t)

    if _REFERENCIA_RE.search(t):
        return ParseResult(confidence="low", intent="unknown", raw_text=t)

    if _CONFIRMAR_RE.match(t):
        return ParseResult(confidence="high", intent="confirmar", raw_text=t)
    if _CANCELAR_RE.match(t):
        return ParseResult(confidence="high", intent="cancelar", raw_text=t)

    if _CIERRE_RE.search(t) and not _ITEM_RE.search(t):
        return ParseResult(confidence="high", intent="cierre", raw_text=t)

    m_num = _NUMERO_RE.match(t)
    if m_num:
        raw_cant = m_num.group(1).replace(",", ".")
        unidad = (m_num.group("unidad") or "").strip().lower() or None
        return ParseResult(
            confidence="high",
            intent="cantidad",
            cantidad_valor=float(raw_cant),
            unidad_valor=unidad,
            raw_text=t,
        )

    if _is_multi_operation_message(t):
        return ParseResult(confidence="low", intent="unknown", raw_text=t)

    if _is_complex_modification(t) or _is_complex_material_message(t):
        return ParseResult(confidence="low", intent="unknown", raw_text=t)

    m_cor = _CORRECCION_RE.search(t)
    if m_cor:
        raw_cant = m_cor.group("cantidad").replace(",", ".")
        unidad = (m_cor.group("unidad") or "").strip().lower() or None
        item_desc = _clean_target(m_cor.group("item")) or ""
        return ParseResult(
            confidence="high",
            intent="comando_modificar",
            items=[ParsedItem(descripcion=item_desc, cantidad=float(raw_cant), unidad=unidad)],
            target_descripcion=item_desc,
            raw_text=t,
        )

    m_desc = _MOD_DESCRIPCION_RE.search(t)
    if m_desc:
        target = _clean_target(m_desc.group("item"))
        detalle = _clean_target(m_desc.group("detalle"))
        nueva = " ".join(part for part in (target, detalle) if part)
        return ParseResult(
            confidence="high",
            intent="comando_modificar",
            target_descripcion=target,
            nueva_descripcion=nueva or None,
            raw_text=t,
        )

    if _CMD_LIMPIAR_RE.search(t):
        return ParseResult(confidence="high", intent="comando_limpiar", raw_text=t)
    if _CMD_MOSTRAR_RE.search(t):
        return ParseResult(confidence="high", intent="comando_mostrar", raw_text=t)
    if _CMD_QUITAR_RE.search(t):
        return ParseResult(
            confidence="high",
            intent="comando_quitar",
            target_descripcion=_extract_command_target(t, _CMD_QUITAR_RE),
            raw_text=t,
        )
    if _CMD_MODIFICAR_RE.search(t):
        target, nueva = _extract_modificar_target(t)
        return ParseResult(
            confidence="high",
            intent="comando_modificar",
            target_descripcion=target,
            nueva_descripcion=nueva,
            raw_text=t,
        )

    items = _extract_items(t)
    if items:
        return ParseResult(confidence="high", intent="item", items=items, raw_text=t)

    return ParseResult(confidence="low", intent="unknown", raw_text=t)


def _extract_items(text: str) -> list[ParsedItem]:
    results: list[ParsedItem] = []
    for m in _ITEM_RE.finditer(text):
        raw_cant = (m.group("cantidad") or "").replace(",", ".")
        cantidad = float(raw_cant) if raw_cant else None
        unidad = (m.group("unidad") or "").strip().lower() or None
        descripcion = m.group("descripcion").strip().rstrip(".,; ")
        descripcion = re.sub(r"\s+[ye]$", "", descripcion, flags=re.IGNORECASE).strip()
        if descripcion:
            results.append(ParsedItem(descripcion=descripcion, cantidad=cantidad, unidad=unidad))
    return results


def _clean_target(text: str | None) -> str | None:
    if not text:
        return None
    value = text.strip().strip(".,;:").lower()
    value = _ARTICULOS_RE.sub("", value)
    value = re.sub(r"\b(?:pedido|item|items|material(?:es)?)\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()
    return value or None


def _is_multi_operation_message(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) > 1:
        return True

    command_hits = sum(
        bool(pattern.search(text))
        for pattern in (_CMD_QUITAR_RE, _CMD_LIMPIAR_RE, _CMD_MOSTRAR_RE, _CMD_MODIFICAR_RE, _CIERRE_RE)
    )
    has_items = bool(_ITEM_RE.search(text))
    if command_hits >= 2:
        return True
    if command_hits and has_items:
        return True
    return False


def _is_complex_modification(text: str) -> bool:
    if not (
        _CMD_MODIFICAR_RE.search(text)
        or re.search(r"\b(?:debe[n]?|tiene[n]?)\s+que\s+ser|debe[n]?\s+ser|eran?|son|es\b", text, re.IGNORECASE)
    ):
        return False
    numbers = re.findall(r"\d+(?:[.,]\d+)?", text)
    if _CORRECCION_RE.search(text) and len(numbers) <= 1:
        return False
    if len(numbers) >= 2:
        return True
    if re.search(r"\b(?:debe[n]?|tiene[n]?)\s+que\s+ser\s+\d|debe[n]?\s+ser\s+\d", text, re.IGNORECASE):
        return True
    if re.search(r"\b(?:y|e|,)\s+de\s+\d+(?:[.,]\d+)?\s*" + _UNIDAD_RE, text, re.IGNORECASE):
        return True
    return False


def _is_complex_material_message(text: str) -> bool:
    if re.search(r"[,;]\s+de\s+\d+(?:[.,]\d+)?\s*" + _UNIDAD_RE, text, re.IGNORECASE):
        return True
    if re.search(r"\s+(?:y|e)\s+de\s+\d+(?:[.,]\d+)?\s*" + _UNIDAD_RE, text, re.IGNORECASE):
        return True
    return False


def _extract_command_target(text: str, command_re: re.Pattern[str]) -> str | None:
    value = command_re.sub("", text, count=1).strip()
    value = re.sub(r"\b(?:del|de\s+la|de\s+los|de\s+las)\b", " ", value, flags=re.IGNORECASE)
    return _clean_target(value)


def _extract_modificar_target(text: str) -> tuple[str | None, str | None]:
    m = re.search(
        r"\b(?:cambiar?|cambi[aá]|modificar?|modific[aá]|actualizar?|actualiz[aá]|"
        r"corregir?|corrig[eé]|poner?|pon[eé]|dejar?|dej[aá])\s+"
        r"(?P<target>[a-záéíóúüñ0-9\s\-]{2,45}?)"
        r"(?:\s+(?:por|a|como|en)\s+(?P<nueva>[a-záéíóúüñ0-9\s\-\.\/]{2,70}))?\s*$",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None, None
    return _clean_target(m.group("target")), _clean_target(m.group("nueva"))
