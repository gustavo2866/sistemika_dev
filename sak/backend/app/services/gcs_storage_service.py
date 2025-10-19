"""
Servicio para gestionar archivos en Google Cloud Storage (GCS)
"""

from __future__ import annotations

import os
from datetime import timedelta
from typing import Any, Dict, Optional

from google.cloud import storage


class GCSStorageService:
    """Servicio de conveniencia para subir y firmar archivos en GCS."""

    def __init__(self) -> None:
        self._client: Optional[storage.Client] = None
        self._bucket_cache: Dict[str, storage.Bucket] = {}

    @property
    def default_bucket_name(self) -> str:
        # Intentar primero GCS_BUCKET_NAME, luego BUCKET_NAME como fallback
        bucket = os.environ.get("GCS_BUCKET_NAME") or os.environ.get("BUCKET_NAME")
        if not bucket:
            raise RuntimeError("GCS_BUCKET_NAME or BUCKET_NAME environment variable is required for GCS operations.")
        return bucket

    @property
    def default_signed_url_ttl(self) -> timedelta:
        ttl_seconds = int(os.environ.get("GCS_SIGNED_URL_SECONDS", str(60 * 60 * 24)))  # 24 horas por defecto
        return timedelta(seconds=ttl_seconds)

    @property
    def default_invoice_folder(self) -> str:
        return os.environ.get("GCS_INVOICE_FOLDER", "facturas")

    @property
    def client(self) -> storage.Client:
        if self._client is None:
            # Intentar usar credenciales explícitas primero
            credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            project_id = os.environ.get("GCS_PROJECT_ID")
            
            if credentials_path and os.path.exists(credentials_path):
                # Local/Development: Usar credenciales del archivo JSON
                print(f"🔑 Using explicit credentials from: {credentials_path}")
                self._client = storage.Client.from_service_account_json(
                    credentials_path,
                    project=project_id
                )
            else:
                # Production/GCP: Usar Application Default Credentials
                print(f"☁️  Using Application Default Credentials for project: {project_id}")
                self._client = storage.Client(project=project_id)
        return self._client

    def _get_bucket(self, bucket_name: Optional[str] = None) -> storage.Bucket:
        name = bucket_name or self.default_bucket_name
        if name not in self._bucket_cache:
            self._bucket_cache[name] = self.client.bucket(name)
        return self._bucket_cache[name]

    def upload_file(
        self,
        file_path: str,
        filename: str,
        *,
        folder: Optional[str] = None,
        content_type: Optional[str] = None,
        bucket_name: Optional[str] = None,
        signed_url_ttl: Optional[timedelta] = None,
    ) -> Dict[str, Any]:
        bucket = self._get_bucket(bucket_name)
        folder_name = (folder or self.default_invoice_folder).strip("/")
        blob_name = f"{folder_name}/{filename}"

        blob = bucket.blob(blob_name)
        blob.upload_from_filename(file_path, content_type=content_type)

        storage_uri = f"gs://{bucket.name}/{blob_name}"
        # Usar URL pública directamente (bucket es público)
        download_url = f"https://storage.googleapis.com/{bucket.name}/{blob_name}"

        return {
            "storage_uri": storage_uri,
            "download_url": download_url,
            "blob_name": blob_name,
            "bucket": bucket.name,
        }

    def upload_invoice(
        self,
        file_path: str,
        filename: str,
        *,
        content_type: Optional[str] = None,
        bucket_name: Optional[str] = None,
        signed_url_ttl: Optional[timedelta] = None,
    ) -> Dict[str, Any]:
        return self.upload_file(
            file_path=file_path,
            filename=filename,
            folder=self.default_invoice_folder,
            content_type=content_type,
            bucket_name=bucket_name,
            signed_url_ttl=signed_url_ttl,
        )

    def generate_signed_url(
        self,
        blob_name: str,
        *,
        expiration: Optional[timedelta] = None,
        bucket_name: Optional[str] = None,
        method: str = "GET",
    ) -> str:
        bucket = self._get_bucket(bucket_name)
        blob = bucket.blob(blob_name)

        if not blob.exists():
            raise FileNotFoundError(f"El objeto {blob_name!r} no existe en el bucket {bucket.name}")

        # Intentar generar URL firmada si tenemos credenciales
        credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if credentials_path and os.path.exists(credentials_path):
            try:
                ttl = expiration or self.default_signed_url_ttl
                return blob.generate_signed_url(expiration=ttl, method=method)
            except Exception as e:
                # Si falla la URL firmada, usar URL pública
                print(f"Warning: No se pudo generar URL firmada: {e}")
                return blob.public_url
        else:
            # Sin credenciales, usar URL pública
            return blob.public_url

    @staticmethod
    def blob_name_from_uri(storage_uri: str) -> str:
        if not storage_uri.startswith("gs://"):
            raise ValueError(f"URI no soportada: {storage_uri}")
        _, _, path = storage_uri.partition("://")
        return path.split("/", 1)[1]


# Instancia global
storage_service = GCSStorageService()

