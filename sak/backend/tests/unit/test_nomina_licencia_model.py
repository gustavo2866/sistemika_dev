from decimal import Decimal

from app.models.nomina_licencia import NominaLicencia
from app.models.partediario import ParteDiario, ParteDiarioDetalle


def test_nomina_licencia_exposes_expected_structure() -> None:
    assert NominaLicencia.__tablename__ == "nomina_licencias"
    assert "nomina_id" in NominaLicencia.model_fields
    assert "tipo_novedad" in NominaLicencia.model_fields
    assert "fecha_desde" in NominaLicencia.model_fields
    assert "fecha_hasta" in NominaLicencia.model_fields
    assert "documentos" in NominaLicencia.model_fields
    assert "nomina_licencia_id" in ParteDiarioDetalle.model_fields


def test_parte_diario_exposes_jornada_field_with_default_hours() -> None:
    assert "jornada" in ParteDiario.model_fields
    assert ParteDiario.model_fields["jornada"].default == Decimal("9")
