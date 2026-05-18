"""
Chat de prueba para el agente secretario_materiales.
Uso: python tests/chat_test.py [oportunidad_id]
"""
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://localhost:8000"
DEFAULT_OPORTUNIDAD = 189


def simular(oportunidad_id: int, texto: str) -> dict:
    url = f"{BASE_URL}/crm/mensajes/acciones/chat/{oportunidad_id}/simular"
    data = json.dumps({"texto": texto}).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def mostrar_items(items: list) -> None:
    if not items:
        print("  (lista vacía)")
        return
    for item in items:
        cant = item.get("cantidad")
        unidad = item.get("unidad") or ""
        desc = item.get("descripcion") or item.get("familia") or "?"
        if cant is not None:
            print(f"  - {cant} {unidad} {desc}".strip())
        else:
            print(f"  - {desc} (sin cantidad)")


def limpiar_estado(oportunidad_id: int) -> None:
    import pathlib
    base = pathlib.Path(__file__).resolve().parents[1]
    archivos = [
        base / "agente" / "v2" / "core" / "state" / "secretario_requests" / f"oportunidad_{oportunidad_id}.json",
        base / "agente" / "v2" / "core" / "state" / "secretario_conversations" / f"oportunidad_{oportunidad_id}.json",
    ]
    for f in archivos:
        if f.exists():
            f.unlink()
    print("[Estado limpiado]\n")


def main():
    oportunidad_id = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OPORTUNIDAD
    print(f"=== Chat con agente secretario (oportunidad {oportunidad_id}) ===")
    print("Comandos: 'items' ver lista, 'limpiar' borrar estado, 'salir' terminar.\n")

    while True:
        try:
            texto = input("Vos: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nChau.")
            break

        if not texto:
            continue
        if texto.lower() == "salir":
            print("Chau.")
            break
        if texto.lower() == "limpiar":
            limpiar_estado(oportunidad_id)
            continue

        t_inicio = time.time()
        hora_envio = datetime.now().strftime("%H:%M:%S")
        try:
            resultado = simular(oportunidad_id, texto)
        except urllib.error.URLError as e:
            print(f"[Error] No se pudo conectar al servidor: {e.reason}")
            continue
        except Exception as e:
            print(f"[Error] {e}")
            continue
        t_total = time.time() - t_inicio
        hora_respuesta = datetime.now().strftime("%H:%M:%S")

        respuesta = resultado.get("respuesta") or "(sin respuesta)"
        print(f"\n[{hora_envio} → {hora_respuesta} | {t_total:.1f}s]")
        print(f"Agente: {respuesta}\n")

        if texto.lower() == "items":
            items = (resultado.get("solicitud") or {}).get("items", [])
            mostrar_items(items)
            print()

        warnings = resultado.get("warnings") or []
        if warnings:
            print(f"[Avisos: {', '.join(warnings)}]\n")


if __name__ == "__main__":
    main()
