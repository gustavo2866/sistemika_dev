from scripts.sync_erp_libro_mayor import (
    DEFAULT_DESDE,
    DEFAULT_HASTA,
    iter_periodos,
    parse_args,
)


def test_rango_por_defecto_cubre_202401_a_202609_inclusive():
    args = parse_args([])
    periodos = iter_periodos(args.desde, args.hasta)

    assert args.desde == DEFAULT_DESDE == "202401"
    assert args.hasta == DEFAULT_HASTA == "202609"
    assert periodos[0] == "202401"
    assert periodos[-1] == "202609"
    assert len(periodos) == 33


def test_iter_periodos_acepta_formato_con_guion():
    assert iter_periodos("2025-11", "2026-02") == [
        "202511",
        "202512",
        "202601",
        "202602",
    ]
