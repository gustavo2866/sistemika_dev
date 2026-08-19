from app.modules.channels.utils import normalize_phone_for_meta


def test_normalize_phone_for_meta_keeps_buenos_aires_mobile_format():
    assert normalize_phone_for_meta("5491156384310") == "+541156384310"


def test_normalize_phone_for_meta_adds_15_for_argentina_interior_mobile():
    assert normalize_phone_for_meta("5493816976725") == "+54381156976725"


def test_normalize_phone_for_meta_accepts_plus_prefix():
    assert normalize_phone_for_meta("+5493816976725") == "+54381156976725"
