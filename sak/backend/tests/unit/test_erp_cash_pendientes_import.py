from sqlmodel import select

from app.models.erp.cash_pendientes_input import ErpCashPendientesInput
from app.models.erp.empresa import ErpEmpresa
from app.services.erp_cash_pendientes_import_service import (
    import_cash_pendientes_csv,
    parse_cash_pendientes_csv,
)


HEADER = (
    "TIPCOMP;NOMBRE;SUCURSAL;NROCOMP;TIPSUB;NROSUB;SUBS_DESCRIP;"
    "FECVENC;FECPRE;SALDO;IMP EXT.;NROCTA;DESCRIP;\n"
)


def _csv(*rows: str) -> bytes:
    return (HEADER + "\n".join(rows) + "\n").encode("cp1252")


def _empresa(db_session) -> ErpEmpresa:
    empresa = ErpEmpresa(empresa_id=1, empresa_nombre="BATIA", grupo="wcl")
    db_session.add(empresa)
    db_session.commit()
    db_session.refresh(empresa)
    return empresa


def test_parse_supports_cp1252_and_unescaped_semicolon_in_description():
    content = _csv(
        "4;OpAlq;3;2599;1;1238;PEÑÓN;30/09/2013;25/03/2019;-59310;0;1392;Texto; adicional;"
    )

    rows = parse_cash_pendientes_csv(content)

    assert len(rows) == 1
    assert rows[0]["subs_descrip_raw"] == "PEÑÓN"
    assert rows[0]["descrip_raw"] == "Texto; adicional"
    assert rows[0]["row_number"] == 2
    assert rows[0]["is_valid"] is True


def test_import_replaces_only_rows_for_selected_empresa(db_session):
    empresa = _empresa(db_session)
    first = _csv(
        "4;OpAlq;3;2599;1;1238;Persona;30/09/2013;25/03/2019;-59310;0;1392;Primero;"
    )
    second = _csv(
        "9;DGtaP;0;3781;1;4118;Otra;13/04/2023;13/04/2023;-50000;0;144;Segundo;"
    )

    first_result = import_cash_pendientes_csv(
        db_session,
        content=first,
        file_name="primero.csv",
        erp_empresa_id=empresa.id,
    )
    second_result = import_cash_pendientes_csv(
        db_session,
        content=second,
        file_name="segundo.csv",
        erp_empresa_id=empresa.id,
    )

    records = db_session.exec(select(ErpCashPendientesInput)).all()
    assert first_result["rows_imported"] == 1
    assert second_result["rows_deleted"] == 1
    assert len(records) == 1
    assert records[0].erp_empresa_id == empresa.id
    assert records[0].file_name == "segundo.csv"
    assert records[0].descrip_raw == "Segundo"


def test_import_is_idempotent_for_same_file(db_session):
    empresa = _empresa(db_session)
    content = _csv(
        "4;OpAlq;3;2599;1;1238;Persona;30/09/2013;25/03/2019;-59310;0;1392;Registro;"
    )

    import_cash_pendientes_csv(
        db_session,
        content=content,
        file_name="pendientes.csv",
        erp_empresa_id=empresa.id,
    )
    duplicate = import_cash_pendientes_csv(
        db_session,
        content=content,
        file_name="pendientes.csv",
        erp_empresa_id=empresa.id,
    )

    assert duplicate["duplicate"] is True
    assert duplicate["rows_imported"] == 0
    assert len(db_session.exec(select(ErpCashPendientesInput)).all()) == 1
