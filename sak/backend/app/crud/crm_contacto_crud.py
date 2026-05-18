from app.core.generic_crud import GenericCRUD
from app.models import CRMContacto
from sqlalchemy import func, or_


def _normalize_phone_expression(value):
    normalized = func.coalesce(value, "")
    for token in ("+", " ", "-", "(", ")"):
        normalized = func.replace(normalized, token, "")
    return normalized


def _normalize_phone_search(value: str) -> str:
    normalized = value
    for token in ("+", " ", "-", "(", ")"):
        normalized = normalized.replace(token, "")
    return normalized


class CRMContactoCRUD(GenericCRUD):
    def _apply_text_search(self, stmt, search_text: str):
        search_text = str(search_text or "").strip()
        if not search_text:
            return stmt

        text_term = f"%{search_text}%"
        phone_term = f"%{_normalize_phone_search(search_text)}%"
        telefono_principal = CRMContacto.telefonos[0].as_string()

        return stmt.where(
            or_(
                CRMContacto.nombre_completo.ilike(text_term),
                CRMContacto.email.ilike(text_term),
                telefono_principal.ilike(text_term),
                _normalize_phone_expression(telefono_principal).ilike(phone_term),
            )
        )


crm_contacto_crud = CRMContactoCRUD(CRMContacto)
