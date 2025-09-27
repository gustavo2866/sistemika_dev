import io
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api import factura_processing as fp
from app.models.comprobante import Comprobante
from app.models.proveedor import Proveedor
from app.models.tipo_operacion import TipoOperacion
from app.services import pdf_extraction_service as pdf_service

PDF_BYTES = (
    b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    b"2 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\ntrailer\n"
    b"<< /Root 1 0 R >>\n%%EOF"
)


class DummyFacturaService:
    def __init__(self) -> None:
        self.uploads_dir = Path("uploads/facturas")
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    async def process_uploaded_pdf(
        self,
        file_path: str,
        original_filename: str,
        proveedor_id: int,
        tipo_operacion_id: int,
    ) -> dict:
        stored_name = Path(file_path).name
        return {
            "numero": "",
            "punto_venta": "",
            "tipo_comprobante": "B",
            "fecha_emision": "2024-01-01",
            "fecha_vencimiento": None,
            "subtotal": 0.0,
            "total_impuestos": 0.0,
            "total": 0.0,
            "estado": "pendiente",
            "observaciones": f"Procesado desde: {original_filename}",
            "nombre_archivo_pdf": original_filename,
            "nombre_archivo_pdf_guardado": stored_name,
            "ruta_archivo_pdf": file_path,
            "stored_filename": stored_name,
            "comprobante_id": None,
            "proveedor_id": proveedor_id,
            "tipo_operacion_id": tipo_operacion_id,
        }

    async def extract_basic_info(self, file_path: str, original_filename: str | None = None) -> dict:
        stored_name = Path(file_path).name
        original = original_filename or stored_name
        return {
            "file_path": file_path,
            "file_name": original,
            "nombre_archivo_pdf": original,
            "nombre_archivo_pdf_guardado": stored_name,
            "ruta_archivo_pdf": file_path,
            "stored_filename": stored_name,
        }

    def validate_file(self, file_path: str) -> bool:
        return file_path.endswith(".pdf")


class DummyExtractionService:
    version = "test"

    async def extract_from_pdf(self, file_path: str, method: str):
        return self._payload(method)

    async def extract_from_image(self, file_path: str, method: str):
        return self._payload(method)

    def _payload(self, method: str):
        return SimpleNamespace(
            numero="0001",
            punto_venta="0001",
            tipo_comprobante="A",
            fecha_emision="2024-01-01",
            fecha_vencimiento=None,
            proveedor_nombre="Proveedor Demo",
            proveedor_cuit="20-00000000-1",
            proveedor_direccion="Direccion",
            receptor_nombre="Cliente Demo",
            receptor_cuit="30-00000000-9",
            receptor_direccion="Direccion",
            subtotal=100.0,
            total_impuestos=21.0,
            total=121.0,
            detalles=[],
            impuestos=[],
            confianza_extraccion=0.9,
            metodo_extraccion=method,
            texto_extraido="demo",
        )


def _create_catalog_entries(session: Session) -> tuple[int, int]:
    prov = Proveedor(
        nombre="Proveedor",
        razon_social="Proveedor SA",
        cuit=f"20-{uuid4().hex[:8]}-1",
    )
    tipo = TipoOperacion(
        codigo=f"T{uuid4().hex[:4]}",
        descripcion="Operacion",
    )
    session.add(prov)
    session.add(tipo)
    session.commit()
    session.refresh(prov)
    session.refresh(tipo)
    return prov.id, tipo.id


def test_upload_and_extract_factura_pdf(client: TestClient, db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(fp, "factura_service", DummyFacturaService())

    proveedor_id, tipo_operacion_id = _create_catalog_entries(db_session)

    files = {"file": ("factura.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {
        "proveedor_id": str(proveedor_id),
        "tipo_operacion_id": str(tipo_operacion_id),
        "auto_extract": "false",
    }
    upload_response = client.post("/api/v1/facturas/upload-pdf", files=files, data=data)
    assert upload_response.status_code == 200, upload_response.text
    upload_body = upload_response.json()
    file_path = Path(upload_body["file_path"])
    assert file_path.exists()

    template = upload_body["template_data"]
    assert template["nombre_archivo_pdf"] == "factura.pdf"
    assert template["nombre_archivo_pdf_guardado"].endswith(file_path.name)
    assert template["ruta_archivo_pdf"] == str(file_path)

    file_info = upload_body["file_info"]
    assert file_info["nombre_archivo_pdf"] == "factura.pdf"
    assert file_info["file_name"] == "factura.pdf"
    assert file_info["nombre_archivo_pdf_guardado"].endswith(file_path.name)
    assert file_info["stored_filename"] == file_path.name
    assert file_info["ruta_archivo_pdf"] == str(file_path)
    assert file_info["file_path"] == str(file_path)

    extract_data = {
        "file_path": str(file_path),
        "proveedor_id": str(proveedor_id),
        "tipo_operacion_id": str(tipo_operacion_id),
    }
    extract_response = client.post("/api/v1/facturas/extract-from-file", data=extract_data)
    assert extract_response.status_code == 200, extract_response.text
    extract_body = extract_response.json()
    assert extract_body["data"]["nombre_archivo_pdf"] == file_path.name
    assert extract_body["data"]["nombre_archivo_pdf_guardado"].endswith(file_path.name)
    assert extract_body["data"]["ruta_archivo_pdf"] == str(file_path)

    list_response = client.get("/api/v1/facturas/files/")
    assert list_response.status_code == 200
    files_list = list_response.json()["files"]
    assert any(entry["filename"] == file_path.name and entry["url"].endswith(file_path.name) for entry in files_list)

    if file_path.exists():
        file_path.unlink()


def test_parse_pdf_endpoint(client: TestClient, db_session: Session, monkeypatch) -> None:
    monkeypatch.setattr(fp, "factura_service", DummyFacturaService())
    monkeypatch.setattr(pdf_service, "PDFExtractionService", lambda: DummyExtractionService())

    proveedor_id, tipo_operacion_id = _create_catalog_entries(db_session)

    files = {"file": ("factura.pdf", io.BytesIO(PDF_BYTES), "application/pdf")}
    data = {
        "proveedor_id": str(proveedor_id),
        "tipo_operacion_id": str(tipo_operacion_id),
        "extraction_method": "auto",
    }
    response = client.post("/api/v1/facturas/parse-pdf/", files=files, data=data)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["file_path"].endswith(".pdf")
    assert body["stored_filename"].endswith(".pdf")
    assert body["data"]["archivo_subido"].endswith(".pdf")
    assert body["data"]["nombre_archivo_pdf"] == "factura.pdf"
    assert body["data"]["nombre_archivo_pdf_guardado"].endswith(".pdf")
    assert body["data"]["ruta_archivo_pdf"] == body["file_path"]
    assert body["comprobante_id"] is not None
    assert body["data"]["comprobante_id"] == body["comprobante_id"]
    assert body["ruta_archivo_pdf"] == body["file_path"]

    comprobante = db_session.get(Comprobante, body["comprobante_id"])
    assert comprobante is not None
    assert comprobante.archivo_guardado == body["stored_filename"]
    assert comprobante.archivo_ruta == body["ruta_archivo_pdf"]

    saved_path = Path(body["file_path"])
    if saved_path.exists():
        saved_path.unlink()
    temp_path = Path("uploads/temp")
    if temp_path.exists():
        for candidate in temp_path.iterdir():
            if candidate.is_file():
                candidate.unlink()

