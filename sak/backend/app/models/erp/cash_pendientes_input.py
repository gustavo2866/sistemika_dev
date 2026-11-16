from datetime import UTC, datetime
from typing import TYPE_CHECKING, ClassVar, List, Optional

from sqlmodel import Field, Relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.erp.cash_cuenta import ErpCashCuenta
    from app.models.erp.empresa import ErpEmpresa


class ErpCashPendientesInput(Base, table=True):
    """Registros crudos importados desde archivos de pendientes cash."""

    __tablename__ = "erp_cash_pendientes_input"
    __searchable_fields__: ClassVar[List[str]] = [
        "file_name",
        "source_name",
        "nombre_raw",
        "descrip_raw",
    ]

    erp_empresa_id: int = Field(
        foreign_key="erp_empresas.id",
        index=True,
        description="Empresa ERP a la que pertenece el archivo importado",
    )
    empresa: Optional["ErpEmpresa"] = Relationship()
    cuenta_cash_id: Optional[int] = Field(
        default=None,
        foreign_key="erp_cash_cuentas.id",
        index=True,
        description="FK opcional a la cuenta Cash asignada por el mapeo contable",
    )
    cuenta_cash: Optional["ErpCashCuenta"] = Relationship()
    uploaded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
        description="Fecha y hora de carga del archivo",
    )
    uploaded_by: Optional[int] = Field(
        default=None,
        description="Usuario que realizó la importación",
    )
    source_name: str = Field(
        default="cash_pendientes",
        max_length=100,
        index=True,
        description="Nombre del origen del reporte",
    )
    file_name: str = Field(
        max_length=255,
        index=True,
        description="Nombre original del archivo cargado",
    )
    file_hash: Optional[str] = Field(
        default=None,
        max_length=128,
        index=True,
        description="Hash del archivo para detectar duplicados",
    )
    import_status: str = Field(
        default="pending",
        max_length=30,
        index=True,
        description="Estado del proceso: pending|processing|imported|failed",
    )
    validation_status: str = Field(
        default="pending",
        max_length=30,
        index=True,
        description="Estado de validación: pending|valid|invalid",
    )
    row_number: int = Field(
        index=True,
        description="Número de fila del registro dentro del archivo",
    )
    tipcomp_raw: Optional[str] = Field(default=None, max_length=50)
    nombre_raw: Optional[str] = Field(default=None, max_length=255)
    sucursal_raw: Optional[str] = Field(default=None, max_length=50)
    nrocomp_raw: Optional[str] = Field(default=None, max_length=50)
    tipsub_raw: Optional[str] = Field(default=None, max_length=50)
    nrosub_raw: Optional[str] = Field(default=None, max_length=50)
    subs_descrip_raw: Optional[str] = Field(default=None, max_length=255)
    fecvenc_raw: Optional[str] = Field(default=None, max_length=30)
    fecpre_raw: Optional[str] = Field(default=None, max_length=30)
    saldo_raw: Optional[str] = Field(default=None, max_length=100)
    imp_ext_raw: Optional[str] = Field(default=None, max_length=100)
    nrocta_raw: Optional[str] = Field(default=None, max_length=50)
    descrip_raw: Optional[str] = Field(default=None, max_length=1000)
    is_valid: bool = Field(
        default=False,
        index=True,
        description="Indica si la fila cumple la validación mínima",
    )
    validation_errors: Optional[str] = Field(
        default=None,
        description="Errores de validación de la fila serializados",
    )
    raw_row: Optional[str] = Field(
        default=None,
        description="JSON o representación textual cruda de la fila importada",
    )

    def __repr__(self) -> str:
        return (
            f"ErpCashPendientesInput(id={self.id}, erp_empresa_id={self.erp_empresa_id}, "
            f"file_name={self.file_name!r}, row_number={self.row_number}, "
            f"status={self.import_status!r})"
        )
