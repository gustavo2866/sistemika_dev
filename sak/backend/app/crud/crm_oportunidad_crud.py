from datetime import UTC, datetime, timedelta
from typing import Any, Dict, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.models import CRMOportunidad


class CRMOportunidadCRUD(GenericCRUD):
    def _apply_filters(self, stmt, filters):  # type: ignore[override]
        panel_window_days = filters.pop("panel_window_days", None)
        if panel_window_days is not None:
            try:
                days = int(panel_window_days)
            except (TypeError, ValueError):
                days = 0
            if days > 0:
                cutoff = datetime.now(UTC) - timedelta(days=days)
                stmt = stmt.where(self.model.fecha_estado >= cutoff)

        return super()._apply_filters(stmt, filters)

    def list(
        self,
        session: Session,
        page: int = 1,
        per_page: int = 25,
        sort_by: str = "created_at",
        sort_dir: str = "asc",
        filters: Optional[Dict[str, Any]] = None,
        deleted: str = "exclude",
        fields: Optional[str] = None,
        include: Optional[str] = None,
    ) -> Tuple[Sequence[CRMOportunidad], int]:
        stmt = select(self.model)
        stmt = self._apply_auto_includes(stmt)

        if include:
            stmt = self._apply_include(stmt, include)

        if filters:
            stmt = self._apply_filters(stmt, filters)

        stmt = self._apply_soft_delete_filter(stmt, deleted)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = session.exec(count_stmt).one()

        if hasattr(self.model, sort_by):
            order_column = getattr(self.model, sort_by)
            if sort_by == "estado":
                if sort_dir.lower() == "desc":
                    stmt = stmt.order_by(order_column.desc(), self.model.id.desc())
                else:
                    stmt = stmt.order_by(order_column.asc(), self.model.id.asc())
            elif sort_dir.lower() == "desc":
                stmt = stmt.order_by(order_column.desc())
            else:
                stmt = stmt.order_by(order_column.asc())

        offset = (page - 1) * per_page
        stmt = stmt.offset(offset).limit(per_page)

        items = session.exec(stmt).all()
        if items:
          self._populate_calculated(session, list(items))
          self._populate_calculated_relations(session, list(items))
        return items, total


crm_oportunidad_crud = CRMOportunidadCRUD(CRMOportunidad)
