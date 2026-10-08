from app.models.erp.cash_cuenta import ErpCashCuenta, infer_cash_cuenta_tipo


def test_infer_cash_cuenta_tipo_por_prefijo() -> None:
    assert infer_cash_cuenta_tipo("INGR x COBRO OBRAS") == "Ingreso"
    assert infer_cash_cuenta_tipo("EGR x PROVEEDORES OBRAS") == "Egreso"
    assert infer_cash_cuenta_tipo("FONDO BANCOS") == "Fondo"
    assert infer_cash_cuenta_tipo("CAJAS COMPENS") is None


def test_erp_cash_cuenta_autocompleta_tipo() -> None:
    ingreso = ErpCashCuenta(descripcion="INGR x COBRO OBRAS")
    egreso = ErpCashCuenta(descripcion="EGR x PROVEEDORES OBRAS")
    fondo = ErpCashCuenta(descripcion="FONDO BANCOS")
    sin_tipo = ErpCashCuenta(descripcion="CAJAS COMPENS")

    assert ingreso.tipo == "Ingreso"
    assert egreso.tipo == "Egreso"
    assert fondo.tipo == "Fondo"
    assert sin_tipo.tipo is None
