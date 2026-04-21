#!/usr/bin/env python3
"""
clean_data.py — Limpieza de datos operativos para inicialización de ambiente.

Uso:
    python clean_data.py                         # Menú interactivo
    python clean_data.py --todo                  # Limpia todos los módulos
    python clean_data.py --modulo crm            # Solo CRM
    python clean_data.py --modulo inmobiliaria   # Solo Inmobiliaria
    python clean_data.py --modulo compras        # Solo Compras (PO + legacy)
    python clean_data.py --modulo proyectos      # Solo Proyectos
    python clean_data.py --modulo rrhh           # Solo RRHH  
    python clean_data.py --modulo sistema        # Solo Sistema/Global
    python clean_data.py --dry-run --todo        # Muestra qué haría sin ejecutar

Requiere: backend/.env con DATABASE_URL configurada.
"""

import argparse
import os
import sys
from pathlib import Path

# ─── Colores ──────────────────────────────────────────────────────────────────
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

def _ok(msg):   print(f"  {GREEN}✓{RESET} {msg}")
def _err(msg):  print(f"  {RED}✗{RESET} {msg}", file=sys.stderr)
def _warn(msg): print(f"  {YELLOW}!{RESET} {msg}")
def _info(msg): print(f"  {DIM}·{RESET} {msg}")


# ─── Carga de .env ────────────────────────────────────────────────────────────
def _load_env(path: Path) -> None:
    """Carga variables de entorno desde un .env sin dependencias externas."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key   = key.strip()
        value = value.strip().strip('"').strip("'")
        if key not in os.environ:
            os.environ[key] = value


# Busca backend/.env subiendo desde la ubicación del script
_script_dir = Path(__file__).resolve().parent
_env_path   = _script_dir.parents[2] / "backend" / ".env"
_load_env(_env_path)

_DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not _DATABASE_URL:
    _err("DATABASE_URL no encontrada. Configure backend/.env o exporte la variable.")
    sys.exit(1)

# Convierte prefijo SQLAlchemy → psycopg puro
_DSN = _DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")


# ─── Definición de módulos ────────────────────────────────────────────────────
#
# Reglas de orden para cada módulo:
#   - Las tablas se listan de HIJOS a PADRES (para que TRUNCATE no falle por FK).
#   - pre_sql: sentencias a ejecutar ANTES de truncar (ej: romper FK circular).
#   - cross_deps: módulos que DEBEN ejecutarse antes (dependencia inter-módulo).
#
# Dependencias cruzadas relevantes:
#   proyectos.proyectos     → crm_oportunidades  (CRM)
#   compras.po_orders       → crm_oportunidades  (CRM)
#   compras.po_invoices     → crm_oportunidades  (CRM)
#   compras.facturas        → propiedades         (Inmobiliaria)
#   rrhh.partes_diario_det  → partes_diario       (Proyectos)
#   rrhh.partes_diario_det  → nominas             (RRHH — self)
#
# FK circular: crm_oportunidades.ultimo_mensaje_id ↔ crm_mensajes.id
#   → Se rompe con UPDATE antes de truncar crm_mensajes.

MODULES_DEF = [
    {
        "key":   "rrhh",
        "label": "RRHH",
        "tables": [
            ("partes_diario_detalles", "Líneas de partes diarios (FK → partes_diario, nominas)"),
            ("nominas",                "Empleados"),
            ("tareas",                 "Tareas asignadas"),
        ],
        "pre_sql":    [],
        "cross_deps": [],
    },
    {
        "key":   "proyectos",
        "label": "Proyectos",
        "tables": [
            ("proyecto_avance",   "Avances de proyecto"),
            ("proy_presupuestos", "Presupuestos de proyecto"),
            ("partes_diario",     "Partes diarios de obra"),
            ("proyectos",         "Proyectos (FK → crm_oportunidades)"),
        ],
        "pre_sql":    [],
        # partes_diario_detalles (RRHH) referencia partes_diario
        # Si se corre solo este módulo y hay partes_diario_detalles con datos,
        # el TRUNCATE de partes_diario fallará. Limpiar RRHH primero.
        "cross_deps": ["rrhh"],
    },
    {
        "key":   "compras",
        "label": "Compras (PO + facturas legacy)",
        "tables": [
            # Facturas legacy (referenciadas por nada; referencian propiedades)
            ("factura_impuestos",   "Impuestos de facturas legacy"),
            ("factura_detalles",    "Líneas de facturas legacy"),
            ("facturas",            "Facturas legacy (FK → propiedades)"),
            # Purchase Orders
            ("po_invoice_taxes",    "Impuestos de facturas de proveedor"),
            ("po_invoice_detalles", "Líneas de facturas de proveedor (FK → po_order_details)"),
            ("po_invoices",         "Facturas de proveedor (FK → comprobantes, crm_oportunidades)"),
            ("po_order_status_log", "Log de estados de órdenes"),
            ("po_orders_archivos",  "Archivos adjuntos a órdenes"),
            ("po_order_details",    "Líneas de órdenes de compra"),
            ("po_orders",           "Órdenes de compra (FK → crm_oportunidades)"),
            # Staging y auxiliares
            ("comprobantes",        "Comprobantes OCR/LLM staging"),
            ("cotizacion_moneda",   "Historial de cotizaciones"),
        ],
        "pre_sql":    [],
        "cross_deps": [],
    },
    {
        "key":   "inmobiliaria",
        "label": "Inmobiliaria",
        "tables": [
            ("contratos_archivos",    "Archivos adjuntos a contratos"),
            ("contratos",             "Contratos (auto-ref: contrato_origen_id)"),
            ("propiedades_servicios", "Servicios por propiedad"),
            ("propiedades_log_status","Log de estados de propiedades"),
            ("propiedades",           "Propiedades (FK → crm_contactos)"),
        ],
        "pre_sql": [],
        # facturas (compras) referencian propiedades → limpiar compras primero
        "cross_deps": ["compras"],
    },
    {
        "key":   "crm",
        "label": "CRM",
        "tables": [
            ("crm_oportunidad_log_estado", "Log de estados de oportunidades"),
            # crm_mensajes debe ir antes que crm_eventos (mensaje.evento_id → crm_eventos)
            ("crm_mensajes",               "Mensajes WhatsApp"),
            ("crm_eventos",                "Eventos CRM"),
            # crm_oportunidades va después de borrar todos sus hijos
            ("crm_oportunidades",          "Oportunidades (FK → crm_contactos)"),
            ("crm_contactos",              "Contactos y leads"),
        ],
        # FK circular: crm_oportunidades.ultimo_mensaje_id → crm_mensajes.id
        # Si crm_oportunidades tiene ultimo_mensaje_id NOT NULL, el TRUNCATE
        # de crm_mensajes fallará. Rompemos el ciclo primero.
        "pre_sql": [
            (
                "Romper FK circular: crm_oportunidades.ultimo_mensaje_id → NULL",
                "UPDATE crm_oportunidades SET ultimo_mensaje_id = NULL "
                "WHERE ultimo_mensaje_id IS NOT NULL"
            ),
        ],
        # proyectos y po_orders referencian crm_oportunidades
        "cross_deps": ["proyectos", "compras"],
    },
    {
        "key":   "sistema",
        "label": "Sistema / Global",
        "tables": [
            ("webhook_logs", "Logs de webhooks entrantes"),
        ],
        "pre_sql":    [],
        "cross_deps": [],
    },
]

# Orden correcto para limpieza total (respeta todas las dependencias cruzadas)
FULL_CLEAN_ORDER = ["rrhh", "proyectos", "compras", "inmobiliaria", "crm", "sistema"]


# ─── Conexión ─────────────────────────────────────────────────────────────────
def _get_connection():
    """Retorna conexión psycopg v3 o psycopg2 como fallback."""
    try:
        import psycopg
        return psycopg.connect(_DSN, autocommit=False)
    except ImportError:
        pass
    try:
        import psycopg2
        conn = psycopg2.connect(_DSN)
        conn.autocommit = False
        return conn
    except ImportError:
        _err("Requiere psycopg (v3) o psycopg2. Instale: pip install psycopg")
        sys.exit(1)


def _db_info(cur) -> str:
    try:
        cur.execute("SELECT current_database(), current_setting('server_version')")
        db, ver = cur.fetchone()
        return f"{db}  (PostgreSQL {ver})"
    except Exception:
        return "(desconocido)"


def _count(cur, table: str) -> int:
    try:
        cur.execute(f"SELECT count(*) FROM {table}")  # noqa: S608
        return cur.fetchone()[0]
    except Exception:
        return -1


# ─── Ejecución por módulo ─────────────────────────────────────────────────────
def _clean_module(cur, module: dict, dry_run: bool) -> None:
    label     = module["label"]
    tables    = module["tables"]
    pre_sql   = module.get("pre_sql", [])
    cross_deps = module.get("cross_deps", [])

    print(f"\n{BOLD}{BLUE}── {label} ──{RESET}")

    if cross_deps:
        _warn(f"Dependencia inter-módulo: se requiere que {cross_deps} "
              f"estén limpios antes de este módulo.")

    # PRE-SQL (romper FKs circulares, etc.)
    for pre_label, pre_stmt in pre_sql:
        if dry_run:
            _info(f"[DRY-RUN] {pre_label}")
        else:
            _info(pre_label)
            cur.execute(pre_stmt)

    # TRUNCATE tabla por tabla
    for table, desc in tables:
        before = _count(cur, table) if not dry_run else "?"
        stmt   = f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"
        if dry_run:
            _info(f"[DRY-RUN] {stmt}")
        else:
            cur.execute(stmt)
            after = _count(cur, table)
            _ok(f"{table:<35} {before:>6} filas eliminadas  {DIM}({desc}){RESET}")


# ─── Menú interactivo ─────────────────────────────────────────────────────────
def _interactive_menu() -> list[str] | None:
    options = [{"key": m["key"], "label": m["label"]} for m in MODULES_DEF]
    options.append({"key": "__todo__", "label": f"{BOLD}TODOS LOS MÓDULOS{RESET}"})

    print(f"\n{BOLD}Seleccione qué módulo limpiar:{RESET}")
    for i, opt in enumerate(options, 1):
        print(f"  [{i}] {opt['label']}")
    print(f"  [0] Cancelar")

    raw = input("\nOpción: ").strip()
    try:
        idx = int(raw)
    except ValueError:
        return None

    if idx == 0:
        return None
    if idx == len(options):          # "todos"
        return list(FULL_CLEAN_ORDER)
    if 1 <= idx < len(options):
        return [options[idx - 1]["key"]]
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Limpieza de datos operativos SAK",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--modulo",
        choices=[m["key"] for m in MODULES_DEF],
        metavar="MODULO",
        help="Módulo a limpiar (crm | inmobiliaria | compras | proyectos | rrhh | sistema)",
    )
    parser.add_argument("--todo",    action="store_true", help="Limpiar todos los módulos")
    parser.add_argument("--dry-run", action="store_true", help="No ejecuta cambios, solo muestra")
    args = parser.parse_args()

    # Determinar módulos a limpiar
    if args.todo:
        selected = list(FULL_CLEAN_ORDER)
    elif args.modulo:
        selected = [args.modulo]
    else:
        selected = _interactive_menu()

    if not selected:
        print("Cancelado.")
        return

    # Conexión y encabezado
    conn = _get_connection()
    cur  = conn.cursor()
    info = _db_info(cur)

    print(f"\n{BOLD}{'═'*62}{RESET}")
    print(f"{BOLD}  SAK — Limpieza de datos operativos{RESET}")
    print(f"{'═'*62}{RESET}")
    print(f"  {BOLD}Ambiente:{RESET}  {CYAN}{info}{RESET}")
    print(f"  {BOLD}Módulos:{RESET}   {YELLOW}{', '.join(selected)}{RESET}")
    if args.dry_run:
        print(f"  {BOLD}Modo:{RESET}      {YELLOW}DRY-RUN — no se realizan cambios{RESET}")
    print(f"{'═'*62}{RESET}")

    # Confirmación (solo en modo real)
    if not args.dry_run:
        prompt = (
            f"\n{RED}{BOLD}  ¿Confirma la limpieza? "
            f"Esta acción NO se puede deshacer.{RESET}\n"
            f"  Escriba {BOLD}si{RESET} para continuar: "
        )
        confirm = input(prompt).strip().lower()
        if confirm not in ("si", "s", "yes", "y"):
            print("  Operación cancelada.")
            conn.close()
            return

    # Ordenar los módulos seleccionados según el orden correcto
    module_map = {m["key"]: m for m in MODULES_DEF}
    ordered    = [k for k in FULL_CLEAN_ORDER if k in selected]
    # Agregar módulos que no estén en FULL_CLEAN_ORDER (salvaguarda)
    for k in selected:
        if k not in ordered:
            ordered.append(k)

    try:
        for key in ordered:
            _clean_module(cur, module_map[key], args.dry_run)

        if not args.dry_run:
            conn.commit()
            print(f"\n{GREEN}{BOLD}  ✓ Limpieza completada exitosamente.{RESET}\n")
        else:
            print(f"\n{YELLOW}{BOLD}  [DRY-RUN] No se realizaron cambios.{RESET}\n")

    except Exception as exc:
        conn.rollback()
        _err(f"Error durante la limpieza: {exc}")
        print("  Se realizó rollback. No se modificó ningún dato.", file=sys.stderr)
        conn.close()
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main()
