"""Limites de responsabilidad entre flows, entidades y presentacion."""

import ast
from pathlib import Path

from agente.v3.subprocesses.parte_diario.domain import parte_diario

ROOT = Path(parte_diario.__file__).parents[1]


# Las entidades no deben conducir la conversacion ni depender de sus adaptadores.
def test_domain_no_depende_de_flows_handler_o_llm():
    for path in (ROOT / "domain").glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                assert ".flows" not in module, path.name
                assert ".adapters" not in module, path.name
                assert not any(item.name == "handler" for item in node.names), path.name
            if isinstance(node, ast.ClassDef):
                assert node.name != "ParteDiarioProcess", path.name


# Los flows gestionan el turno y las sesiones, pero las consultas SQL pertenecen a domain.
def test_flows_no_ejecutan_consultas_sql():
    for path in (ROOT / "flows").glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                receiver = node.func.value
                if isinstance(receiver, ast.Name) and receiver.id == "session":
                    assert node.func.attr not in {"exec", "execute", "get", "add", "delete"}, path.name


# La presentacion trabaja con datos precargados y no abre conexiones a la base.
def test_renderer_no_importa_acceso_a_datos():
    path = ROOT / "utils" / "renderer.py"
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            assert node.module not in {"sqlmodel", "sqlalchemy", "app.db"}
            module = node.module or ""
            assert ".domain" not in module or module == "agente.v3.subprocesses.parte_diario.domain.models"


# Los tipos del dominio no deben importar persistencia, flows ni contratos de procesamiento.
def test_modelos_domain_solo_dependen_de_tipos_estandar():
    path = ROOT / "domain" / "models.py"
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            assert node.module in {"__future__", "dataclasses", "typing"}
        elif isinstance(node, ast.Import):
            assert all(item.name in {"dataclasses", "typing"} for item in node.names)
