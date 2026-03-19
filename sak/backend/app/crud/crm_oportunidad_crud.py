from datetime import UTC, datetime, timedelta

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


crm_oportunidad_crud = CRMOportunidadCRUD(CRMOportunidad)
