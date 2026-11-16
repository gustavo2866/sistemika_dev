from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.empresa import ErpEmpresa
from app.routers.erp_cash_pendientes_input_router import erp_cash_pendientes_input_router


def test_cash_pendientes_input_model_metadata():
    assert ErpCashPendientesInput.__tablename__ == "erp_cash_pendientes_input"
    assert "erp_empresa_id" in ErpCashPendientesInput.model_fields
    assert (
        next(iter(ErpCashPendientesInput.__table__.c.erp_empresa_id.foreign_keys)).target_fullname
        == "erp_empresas.id"
    )
    assert (
        next(iter(ErpCashPendientesInput.__table__.c.cuenta_cash_id.foreign_keys)).target_fullname
        == "erp_cash_cuentas.id"
    )
    assert "uploaded_at" in ErpCashPendientesInput.model_fields
    assert "import_status" in ErpCashPendientesInput.model_fields
    assert "tipcomp_raw" in ErpCashPendientesInput.model_fields


def test_erp_empresa_model_metadata():
    assert ErpEmpresa.__tablename__ == "erp_empresas"
    assert "empresa_id" in ErpEmpresa.model_fields
    assert "empresa_nombre" in ErpEmpresa.model_fields
    assert "grupo" in ErpEmpresa.model_fields


def test_cash_pendientes_input_exposes_validation_endpoint():
    methods_by_path = {
        route.path: route.methods or set()
        for route in erp_cash_pendientes_input_router.routes
    }
    assert "POST" in methods_by_path["/erp/cash/pendientes-input/validate"]
