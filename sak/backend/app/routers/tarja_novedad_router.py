from datetime import UTC, datetime
from typing import Any

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.tarja import TarjaNovedad
from sqlmodel import Session, select


class TarjaNovedadCRUD(GenericCRUD[TarjaNovedad]):
    def create(
        self,
        session: Session,
        data: dict[str, Any],
        auto_commit: bool = True,
    ) -> TarjaNovedad:
        tarja_id = data.get("tarja_id")
        nomina_id = data.get("nomina_id")
        if tarja_id:
            stmt = (
                select(TarjaNovedad)
                .where(TarjaNovedad.tarja_id == int(tarja_id))
                .where(TarjaNovedad.deleted_at.is_(None))
            )
            if nomina_id not in (None, ""):
                stmt = stmt.where(TarjaNovedad.nomina_id == int(nomina_id))
            else:
                stmt = stmt.where(TarjaNovedad.nomina_id.is_(None))
            existing = session.exec(stmt).first()
            if existing is not None:
                cleaned = self._clean_create(data)
                for field, value in cleaned.items():
                    setattr(existing, field, self._coerce_field_value(field, value))
                if hasattr(existing, "updated_at"):
                    existing.updated_at = datetime.now(UTC)
                session.add(existing)
                if auto_commit:
                    session.commit()
                    session.refresh(existing)
                else:
                    session.flush()
                return existing

        return super().create(session, data, auto_commit=auto_commit)


tarja_novedad_crud = TarjaNovedadCRUD(TarjaNovedad)

tarja_novedad_router = create_generic_router(
    model=TarjaNovedad,
    crud=tarja_novedad_crud,
    prefix="/tarja-novedades",
    tags=["tarja-novedades"],
)
