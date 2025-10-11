"""
Script CLI para extraer el JSON de una factura utilizando el mismo procedimiento
que emplea el backend (PDFExtractionService).

Uso básico:
    python backend/scripts/extract_factura_json.py <ruta_o_url> [--method auto]
    python -m backend.scripts.extract_factura_json <ruta_o_url>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import sys
import tempfile
from pathlib import Path
from typing import Literal

import requests

# Asegurar que el paquete `app` esté disponible cuando se ejecute el script directamente
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.pdf_extraction_service import PDFExtractionService

ExtractionMethod = Literal["auto", "text", "vision", "rules"]


def is_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def download_to_temp(url: str) -> Path:
    response = requests.get(url, timeout=60)
    response.raise_for_status()

    # Intentar deducir la extensión
    guessed_suffix = Path(url).suffix
    if not guessed_suffix:
        content_type = response.headers.get("Content-Type")
        guessed_suffix = mimetypes.guess_extension(content_type or "") or ".pdf"

    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=guessed_suffix)
    tmp_file.write(response.content)
    tmp_file.flush()
    tmp_file.close()
    return Path(tmp_file.name)


async def extract(path: Path, method: ExtractionMethod) -> dict:
    service = PDFExtractionService()
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        extracted = await service.extract_from_pdf(str(path), extraction_method=method)
    else:
        extracted = await service.extract_from_image(str(path), extraction_method=method)
    return extracted.model_dump()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extrae el JSON de una factura replicando la lógica del backend."
    )
    parser.add_argument(
        "source",
        help="Ruta local o URL del archivo PDF/imagen.",
    )
    parser.add_argument(
        "--method",
        choices=("auto", "text", "vision", "rules"),
        default="auto",
        help="Método de extracción a utilizar (por defecto: auto).",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Imprime el JSON con identación para facilitar su lectura.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    temp_path: Path | None = None

    try:
        if is_url(args.source):
            temp_path = download_to_temp(args.source)
            target_path = temp_path
        else:
            target_path = Path(args.source).expanduser()
            if not target_path.exists():
                raise FileNotFoundError(f"No se encontró el archivo: {target_path}")

        result = asyncio.run(extract(target_path, args.method))

        if args.pretty:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(json.dumps(result, ensure_ascii=False))

        return 0

    except Exception as exc:  # pylint: disable=broad-except
        print(f"Error durante la extracción: {exc}", file=sys.stderr)
        return 1
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
