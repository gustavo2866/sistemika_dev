from __future__ import annotations

from typing import Optional

from sqlmodel import Session, select

from app.models import CRMContacto


class CRMContactoService:
    """Operaciones específicas para contactos CRM."""

    @staticmethod
    def buscar_por_email(session: Session, email: Optional[str]) -> Optional[CRMContacto]:
        if not email:
            return None
        return session.exec(
            select(CRMContacto).where(CRMContacto.email == email)
        ).first()

    @staticmethod
    def buscar_por_telefono(session: Session, telefono: Optional[str]) -> Optional[CRMContacto]:
        if not telefono:
            return None
        # JSON contains search (PostgreSQL)
        return session.exec(
            select(CRMContacto).where(CRMContacto.telefonos.contains([telefono]))
        ).first()

    @staticmethod
    def buscar(session: Session, email: Optional[str], telefono: Optional[str]) -> Optional[CRMContacto]:
        contacto = CRMContactoService.buscar_por_email(session, email)
        if contacto:
            return contacto
        return CRMContactoService.buscar_por_telefono(session, telefono)


crm_contacto_service = CRMContactoService()
