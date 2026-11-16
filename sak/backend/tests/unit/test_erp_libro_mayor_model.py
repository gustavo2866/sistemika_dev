from sqlalchemy import Numeric

from app.models.erp.libro_mayor import ErpLibroMayor
from app.routers.erp_libro_mayor_router import erp_libro_mayor_router


def test_erp_libro_mayor_refleja_estructura_externa():
    assert ErpLibroMayor.__tablename__ == "erp_libro_mayor"
    assert {
        "source_id",
        "empresa_id",
        "periodo_anio",
        "periodo_mes",
        "nivel",
        "cuenta_codigo",
        "tipo_subcuenta",
        "nro_subcuenta",
        "centro_costo",
        "total_debe",
        "total_haber",
        "total_debe_actualizado",
        "total_haber_actualizado",
        "saldo_periodo",
        "saldo_acumulado",
        "recalculado_en",
        "saldo_anterior",
        "fecha_periodo",
    }.issubset(ErpLibroMayor.__table__.columns.keys())
    assert ErpLibroMayor.__table__.c.source_id.unique is True
    assert isinstance(ErpLibroMayor.__table__.c.total_debe.type, Numeric)
    assert isinstance(ErpLibroMayor.__table__.c.total_debe_actualizado.type, Numeric)
    assert ErpLibroMayor.__table__.c.total_debe_actualizado.nullable is True
    assert isinstance(ErpLibroMayor.__table__.c.total_haber_actualizado.type, Numeric)
    assert ErpLibroMayor.__table__.c.total_haber_actualizado.nullable is True
    assert isinstance(ErpLibroMayor.__table__.c.saldo_acumulado.type, Numeric)


def test_erp_libro_mayor_expone_crud_y_saldos():
    methods_by_path: dict[str, set[str]] = {}
    for route in erp_libro_mayor_router.routes:
        methods_by_path.setdefault(route.path, set()).update(route.methods or set())

    assert {"GET", "POST"}.issubset(methods_by_path["/erp/libro-mayor"])
    assert {"GET", "PUT", "PATCH", "DELETE"}.issubset(
        methods_by_path["/erp/libro-mayor/{obj_id:int}"]
    )
    assert "GET" in methods_by_path["/erp/libro-mayor/saldos"]
    assert "POST" in methods_by_path["/erp/libro-mayor/sync"]
    assert "POST" in methods_by_path["/erp/libro-mayor/sync-range"]
    assert "POST" in methods_by_path["/erp/libro-mayor/update-icc"]
    assert "GET" in methods_by_path["/erp/libro-mayor/panel"]
