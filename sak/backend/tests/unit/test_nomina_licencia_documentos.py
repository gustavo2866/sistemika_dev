import asyncio
import json
from datetime import date
from io import BytesIO

from fastapi import UploadFile
from starlette.datastructures import Headers

from app.models.nomina_licencia import NominaLicencia
from app.routers import nomina_licencia_router as router_module


class FakeSession:
    def __init__(self, registro: NominaLicencia) -> None:
        self.registro = registro
        self.committed = False

    def get(self, _model, registro_id: int):
        return self.registro if registro_id == self.registro.id else None

    def add(self, registro: NominaLicencia) -> None:
        self.registro = registro

    def commit(self) -> None:
        self.committed = True

    def refresh(self, _registro: NominaLicencia) -> None:
        return None


def _registro() -> NominaLicencia:
    return NominaLicencia(
        id=7,
        nomina_id=3,
        tipo_novedad="ENF",
        fecha_desde=date(2026, 10, 1),
        fecha_hasta=date(2026, 10, 2),
        documentos=[],
    )


def test_upload_nomina_licencia_documento_guarda_en_gcs(monkeypatch) -> None:
    registro = _registro()
    session = FakeSession(registro)
    upload_call: dict[str, object] = {}

    def fake_upload_file(file_path, filename, **kwargs):
        with open(file_path, "rb") as uploaded:
            upload_call["content"] = uploaded.read()
        upload_call["filename"] = filename
        upload_call.update(kwargs)
        return {
            "download_url": "https://storage.googleapis.com/test/nomina-licencias/7/cert.pdf"
        }

    monkeypatch.setattr(router_module.storage_service, "upload_file", fake_upload_file)
    file = UploadFile(
        filename="certificado.pdf",
        file=BytesIO(b"contenido"),
        headers=Headers({"content-type": "application/pdf"}),
    )

    result = asyncio.run(
        router_module.upload_nomina_licencia_documento(
            id=7,
            file=file,
            nombre="Certificado médico",
            session=session,
        )
    )

    documento = json.loads(result.documentos[0])
    assert upload_call["content"] == b"contenido"
    assert upload_call["folder"] == "nomina-licencias/7"
    assert upload_call["content_type"] == "application/pdf"
    assert documento["nombre"] == "Certificado médico"
    assert documento["size"] == len(b"contenido")
    assert session.committed is True


def test_delete_nomina_licencia_documento_borra_referencia_y_objeto(monkeypatch) -> None:
    url = "https://storage.googleapis.com/test/nomina-licencias/7/cert.pdf"
    registro = _registro()
    registro.documentos = [json.dumps({"url": url, "nombre": "Certificado"})]
    session = FakeSession(registro)
    deleted: list[str] = []

    monkeypatch.setattr(
        router_module.storage_service,
        "blob_name_from_download_url",
        lambda _url: "nomina-licencias/7/cert.pdf",
    )
    monkeypatch.setattr(
        router_module.storage_service,
        "delete_file",
        lambda blob_name: deleted.append(blob_name),
    )

    result = router_module.delete_nomina_licencia_documento(
        id=7,
        payload=router_module.NominaLicenciaDocumentoDeleteRequest(url=url),
        session=session,
    )

    assert result.documentos == []
    assert deleted == ["nomina-licencias/7/cert.pdf"]
    assert session.committed is True
