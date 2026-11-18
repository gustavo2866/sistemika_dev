from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import ClassVar, List, Optional

from pydantic import field_validator
from sqlalchemy import CheckConstraint, Column, Computed, DECIMAL, Index, String, text
from sqlmodel import Field, Session

from app.models.base import Base


def clean_projection_observation(value: str | None) -> str | None:
    """Descarta el detalle automático histórico y conserva las notas del usuario."""
    return None if value and value.lstrip().upper().startswith("AUTO:") else value


def projection_method_values(
    session: Session, account_id: int, method_id: int | None = None,
    *, require_active: bool = True,
) -> dict[str, object]:
    """Copia el criterio vigente al crear o cambiar el método de un período."""
    from app.models.erp.cash_cuenta import ErpCashCuenta
    from app.models.metodo_proyeccion import MetodoProyeccion

    account = session.get(ErpCashCuenta, account_id)
    if account is None or account.deleted_at is not None:
        raise ValueError("La cuenta Cash no existe")
    selected_id = method_id if method_id is not None else account.id_metodo_proyeccion
    method = session.get(MetodoProyeccion, selected_id) if selected_id else None
    if selected_id and (method is None or (require_active and (method.deleted_at is not None or not method.activo))):
        raise ValueError("El método de proyección no existe o no está activo")
    return {
        "id_metodo_proyeccion": selected_id,
        "tipo_calculo": method.tipo_calculo if method else "HISTORICO",
    }


class ErpCashProyectado(Base, table=True):
    __tablename__ = "erp_cash_proyectado"
    __table_args__ = (
        CheckConstraint("origen_proyectado IN ('MANUAL', 'CALCULADO')", name="ck_cash_proyectado_origen"),
        CheckConstraint(
            "tipo_calculo IN ('HISTORICO', 'RELACIONAL', 'PENDIENTE')",
            name="ck_erp_cash_proyectado_tipo_calculo",
        ),
        Index(
            "uq_erp_cash_proyectado_activo_cuenta_periodo",
            "cuenta_cash_id",
            "fecha_periodo",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
    )

    __searchable_fields__: ClassVar[List[str]] = ["observacion"]

    cuenta_cash_id: int = Field(
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK a la cuenta financiera",
    )
    fecha_periodo: date = Field(
        index=True,
        description="Primer dia del mes proyectado",
    )
    id_metodo_proyeccion: Optional[int] = Field(
        default=None, foreign_key="metodo_proyeccion.id", index=True,
        description="Método aplicado a este período",
    )
    tipo_calculo: str = Field(
        default="HISTORICO",
        sa_column=Column(String(20), nullable=False, server_default="HISTORICO"),
        description="Tipo aplicado: HISTORICO, RELACIONAL o PENDIENTE",
    )
    importe_proyectado: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(18, 2), nullable=False, server_default=text("0")),
        description="Importe proyectado para la cuenta y periodo",
    )
    origen_proyectado: str = Field(
        default="CALCULADO", sa_column=Column(String(15), nullable=False, server_default="CALCULADO"),
        description="Los importes manuales no se reemplazan al reconstruir Cash",
    )
    importe_pendiente: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(18, 2), nullable=False, server_default=text("0")),
    )
    importe_comprometido: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(DECIMAL(18, 2), nullable=False, server_default=text("0")),
    )
    total_proyectado: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(
            DECIMAL(18, 2),
            Computed(
                "CASE WHEN tipo_calculo = 'PENDIENTE' THEN importe_pendiente "
                "ELSE importe_proyectado END + importe_comprometido",
                persisted=True,
            ),
            nullable=False,
        ),
        description="Total generado por la base de datos; no editable",
    )
    observacion: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
        description="Observacion opcional",
    )

    @field_validator("fecha_periodo")
    @classmethod
    def validar_fecha_inicio_mes(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("fecha_periodo debe ser el primer dia del mes")
        return value

    def __repr__(self) -> str:
        return (
            f"ErpCashProyectado(id={self.id}, cuenta_cash_id={self.cuenta_cash_id}, "
            f"fecha_periodo={self.fecha_periodo}, total_proyectado={self.total_proyectado})"
        )
