from typing import Optional, TYPE_CHECKING

from sqlmodel import Field, Relationship

from .base import Base

if TYPE_CHECKING:
    from .crm_contacto import CRMContacto
    from .crm_evento import CRMEvento
    from .crm_oportunidad import CRMOportunidad


class CRMTipoOperacion(Base, table=True):
    __tablename__ = "crm_tipos_operacion"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, description="Código único", unique=True, index=True)
    nombre: str = Field(max_length=100, description="Nombre del tipo de operación")
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True, description="Indica si el tipo está activo")

    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="tipo_operacion")


class CRMMotivoPerdida(Base, table=True):
    __tablename__ = "crm_motivos_perdida"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, unique=True, index=True)
    nombre: str = Field(max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="motivo_perdida")


class CRMCondicionPago(Base, table=True):
    __tablename__ = "crm_condiciones_pago"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, unique=True, index=True)
    nombre: str = Field(max_length=200)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="condicion_pago")


class CRMTipoEvento(Base, table=True):
    __tablename__ = "crm_tipos_evento"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, unique=True, index=True)
    nombre: str = Field(max_length=100)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

    eventos: list["CRMEvento"] = Relationship(back_populates="tipo")


class CRMMotivoEvento(Base, table=True):
    __tablename__ = "crm_motivos_evento"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, unique=True, index=True)
    nombre: str = Field(max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

    eventos: list["CRMEvento"] = Relationship(back_populates="motivo")


class CRMOrigenLead(Base, table=True):
    __tablename__ = "crm_origenes_lead"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=50, unique=True, index=True)
    nombre: str = Field(max_length=150)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    activo: bool = Field(default=True)

    contactos: list["CRMContacto"] = Relationship(back_populates="origen_lead")
    eventos: list["CRMEvento"] = Relationship(back_populates="origen_lead")


class Moneda(Base, table=True):
    __tablename__ = "monedas"
    __searchable_fields__ = ["codigo", "nombre"]

    codigo: str = Field(max_length=10, unique=True, index=True)
    nombre: str = Field(max_length=100)
    simbolo: str = Field(max_length=5)
    es_moneda_base: bool = Field(default=False)
    activo: bool = Field(default=True)

    oportunidades: list["CRMOportunidad"] = Relationship(back_populates="moneda")
