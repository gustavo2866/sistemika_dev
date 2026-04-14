from datetime import date
from types import SimpleNamespace

from fastapi import Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.db import get_session
from app.core.router import create_generic_router
from app.crud.tipo_contrato_crud import tipo_contrato_crud
from app.models.tipo_contrato import TipoContrato

tipo_contrato_router = create_generic_router(
    model=TipoContrato,
    crud=tipo_contrato_crud,
    prefix="/tipos-contrato",
    tags=["tipos-contrato"],
)


# --- Vista previa PDF: GET /tipos-contrato/{id}/preview-pdf ---

@tipo_contrato_router.get("/{id}/preview-pdf", tags=["tipos-contrato"])
def preview_tipo_contrato_pdf(id: int, session: Session = Depends(get_session)):
    from app.services.contrato_pdf_service import build_contrato_pdf

    tipo_contrato = session.get(TipoContrato, id)
    if tipo_contrato is None:
        raise HTTPException(status_code=404, detail="Tipo de contrato no encontrado")

    template = tipo_contrato.template
    if not template:
        raise HTTPException(
            status_code=422,
            detail="El tipo de contrato no tiene un template configurado.",
        )

    propietario_ref = SimpleNamespace(
        nombre="María González",
        dni="12.345.678",
        cuit="27-12345678-4",
        domicilio="Calle Corrientes 456, Piso 2",
        email="maria.gonzalez@example.com",
        telefono="(381) 456-7890",
    )
    propiedad = SimpleNamespace(
        nombre="Departamento Centro",
        domicilio="Av. Mitre 1234, Dto. 3B",
        localidad="San Miguel de Tucumán",
        provincia="Tucumán",
        codigo_postal="4000",
        matricula_catastral="123-456/2024",
        metros_cuadrados=65,
        ambientes=3,
        propietario="María González",
        propietario_ref=propietario_ref,
    )
    mock_contrato = SimpleNamespace(
        id=0,
        propiedad=propiedad,
        tipo_contrato=SimpleNamespace(nombre=tipo_contrato.nombre),
        tipo_actualizacion=SimpleNamespace(nombre="ICL (Índice de Contratos de Locación)"),
        fecha_inicio=date(2025, 4, 1),
        fecha_vencimiento=date(2027, 3, 31),
        duracion_meses=24,
        lugar_celebracion="San Miguel de Tucumán",
        inquilino_nombre="Carlos",
        inquilino_apellido="Ramírez",
        inquilino_dni="30.456.789",
        inquilino_cuit="20-30456789-4",
        inquilino_email="carlos.ramirez@example.com",
        inquilino_telefono="(381) 234-5678",
        inquilino_domicilio="Av. Independencia 789",
        garante1_nombre="Roberto",
        garante1_apellido="López",
        garante1_dni="25.678.901",
        garante1_cuit="20-25678901-3",
        garante1_domicilio="Calle San Martín 321",
        garante1_tipo_garantia="Propietario",
        garante2_nombre="Ana",
        garante2_apellido="Martínez",
        garante2_dni="28.901.234",
        garante2_cuit="27-28901234-5",
        garante2_domicilio="Calle Mendoza 654",
        garante2_tipo_garantia="Propietario",
        moneda="ARS",
        valor_alquiler=180_000.0,
        expensas=15_000.0,
        deposito_garantia=180_000.0,
        observaciones="Vista previa generada con datos de muestra.",
    )

    try:
        pdf_bytes = build_contrato_pdf(mock_contrato, template)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Error generando la vista previa: {exc}") from exc

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="preview.pdf"'},
    )
