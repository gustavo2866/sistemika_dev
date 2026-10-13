from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlmodel import select

from agente.v3.subprocesses.parte_diario.domain.models import NominaItem, ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.domain.novedades import execute_plan
from agente.v3.subprocesses.parte_diario.domain.parte_diario import aplicar_fecha, cargar_estados
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.utils import renderer
from app.crud.nomina_licencia_crud import nomina_licencia_crud
from app.models import CRMContacto, Nomina, Proyecto, User
from app.models.nomina_licencia import NominaLicencia
from app.models.parte_diario_estado import ParteDiarioEstado
from app.models.partediario import ParteDiario, ParteDiarioDetalle
from app.models.tarja import EstadoTarja, Tarja, TarjaDetalle, TarjaNomina
from app.routers.partediario_router import parte_diario_crud
from app.services.parte_diario_estado_service import seed_parte_diario_estados
from app.services.parte_diario_service import parte_diario_service
from app.services.nomina_licencia_service import nomina_licencia_service


def _seed_licencia_context(session, *, con_licencia: bool = True):
    seed_parte_diario_estados(session)
    user = User(nombre="Tester", email="parte-licencias@example.com")
    session.add(user)
    session.flush()
    contacto = CRMContacto(
        nombre_completo="Encargado Licencias",
        telefonos=["549111111"],
        responsable_id=user.id,
    )
    proyecto = Proyecto(nombre="Obra Licencias", responsable_id=user.id)
    session.add_all([contacto, proyecto])
    session.flush()
    empleado = Nomina(
        nombre="Ana",
        apellido="Perez",
        dni="licencia-1",
        idproyecto=proyecto.id,
        encargado_contacto_id=contacto.id,
    )
    session.add(empleado)
    session.flush()
    licencia = None
    if con_licencia:
        licencia = NominaLicencia(
            nomina_id=empleado.id,
            tipo_novedad="ENF",
            fecha_desde=date(2026, 10, 10),
            fecha_hasta=None,
            comentario="Certificado medico",
        )
        session.add(licencia)
    session.commit()
    return proyecto, contacto, empleado, licencia


def _estado_licencia(session, codigo: str = "ENF") -> ParteDiarioEstado:
    return session.exec(
        select(ParteDiarioEstado).where(ParteDiarioEstado.abreviatura == codigo)
    ).one()


def test_listado_generico_filtra_partes_por_licencia(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    estado = _estado_licencia(db_session)
    parte = ParteDiario(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fecha=date(2026, 10, 10),
        estado="borrador",
    )
    db_session.add(parte)
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=empleado.id,
        idestado=estado.id,
        nomina_licencia_id=licencia.id,
        horas=0,
        descripcion="Licencia: ENFERMEDAD",
    )
    db_session.add(detalle)
    db_session.commit()

    partes, total = parte_diario_crud.list(
        db_session,
        filters={"detalles.nomina_licencia_id": licencia.id},
    )

    assert total == 1
    assert [item.id for item in partes] == [parte.id]
    assert partes[0].detalles[0].nomina_licencia_id == licencia.id


def test_listado_licencias_filtra_vigencia_y_nomina_correspondiente(db_session):
    proyecto, _contacto, empleado, vigente = _seed_licencia_context(db_session)
    vigente.fecha_hasta = None
    anterior = NominaLicencia(
        nomina_id=empleado.id,
        tipo_novedad="ENF",
        fecha_desde=date(2026, 9, 1),
        fecha_hasta=date(2026, 9, 30),
    )
    futura = NominaLicencia(
        nomina_id=empleado.id,
        tipo_novedad="VAC",
        fecha_desde=date(2026, 10, 16),
        fecha_hasta=date(2026, 10, 20),
    )
    db_session.add_all([vigente, anterior, futura])
    db_session.commit()

    licencias, total = nomina_licencia_crud.list(
        db_session,
        filters={
            "nomina.idproyecto": proyecto.id,
            "vigente_desde": "2026-10-01",
            "vigente_hasta": "2026-10-15",
        },
    )

    assert total == 1
    assert [item.id for item in licencias] == [vigente.id]


def test_form_crea_licencia_faltante_al_crear_parte(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(
        db_session,
        con_licencia=False,
    )
    estado = _estado_licencia(db_session)

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "estado": "borrador",
            "detalles": [
                {
                    "idnomina": empleado.id,
                    "idestado": estado.id,
                    "horas": 0,
                    "descripcion": "Certificado informado en el parte",
                }
            ],
        },
    )

    licencia = db_session.exec(
        select(NominaLicencia).where(NominaLicencia.nomina_id == empleado.id)
    ).one()
    detalle = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()
    assert licencia.tipo_novedad == "ENF"
    assert licencia.fecha_desde == date(2026, 10, 11)
    assert licencia.fecha_hasta is None
    assert licencia.comentario == "Certificado informado en el parte"
    assert detalle.nomina_licencia_id == licencia.id
    assert detalle.descripcion == (
        "Licencia: ENFERMEDAD - Periodo 11/10 a fecha sin definir - "
        "Certificado informado en el parte"
    )


def test_agente_crea_licencia_faltante_al_crear_parte(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(
        db_session,
        con_licencia=False,
    )
    estado = _estado_licencia(db_session)

    parte = parte_diario_service._create_or_update_from_result(
        db_session,
        {
            "type": "parte_diario_reply",
            "parte_listo": True,
            "confirmar_parte": False,
            "cerrar_parte": False,
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "novedades": [
                {
                    "idnomina": empleado.id,
                    "idestado": estado.id,
                    "estado_codigo": "ENF",
                    "horas": 0,
                    "descripcion": "Informada por el encargado",
                }
            ],
            "pendientes_ambiguos": [],
            "conflictos_novedad": [],
        },
        mensaje_id=None,
    )
    db_session.flush()

    licencia = db_session.exec(
        select(NominaLicencia).where(NominaLicencia.nomina_id == empleado.id)
    ).one()
    detalle = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()
    assert licencia.fecha_desde == date(2026, 10, 11)
    assert licencia.fecha_hasta is None
    assert licencia.comentario == "Informada por el encargado"
    assert detalle.nomina_licencia_id == licencia.id


def test_form_reutiliza_licencia_vigente_del_mismo_tipo(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    estado = _estado_licencia(db_session)

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "estado": "borrador",
            "detalles": [
                {
                    "idnomina": empleado.id,
                    "idestado": estado.id,
                    "horas": 0,
                    "descripcion": "Carga manual repetida",
                }
            ],
        },
    )

    licencias = db_session.exec(
        select(NominaLicencia).where(NominaLicencia.nomina_id == empleado.id)
    ).all()
    detalle = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()
    assert len(licencias) == 1
    assert detalle.nomina_licencia_id == licencia.id


def test_form_no_deja_licencia_huerfana_si_el_parte_es_invalido(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(
        db_session,
        con_licencia=False,
    )
    estado = _estado_licencia(db_session)

    with pytest.raises(ValueError, match="no admite otra novedad"):
        parte_diario_crud.create(
            db_session,
            {
                "idproyecto": proyecto.id,
                "contacto_id": contacto.id,
                "fecha": "2026-10-11",
                "estado": "borrador",
                "detalles": [
                    {
                        "idnomina": empleado.id,
                        "idestado": estado.id,
                        "horas": 0,
                    },
                    {
                        "idnomina": empleado.id,
                        "idestado": None,
                        "horas": 9,
                    },
                ],
            },
        )

    assert db_session.exec(select(NominaLicencia)).all() == []


def test_crear_parte_agrega_licencia_y_protege_el_detalle(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)

    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "estado": "borrador",
            "detalles": [],
        },
    )
    detalle = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()

    assert detalle.idnomina == empleado.id
    assert detalle.nomina_licencia_id == licencia.id
    assert float(detalle.horas) == 0
    assert detalle.descripcion == (
        "Licencia: ENFERMEDAD - Periodo 10/10 a fecha sin definir - Certificado medico"
    )

    with pytest.raises(ValueError, match="no se pueden modificar"):
        parte_diario_crud.update(
            db_session,
            parte.id,
            {
                "detalles": [
                    {
                        "id": detalle.id,
                        "idnomina": detalle.idnomina,
                        "idestado": detalle.idestado,
                        "nomina_licencia_id": detalle.nomina_licencia_id,
                        "horas": 0,
                        "ingreso": None,
                        "egreso": None,
                        "descripcion": "Intento de cambio",
                    }
                ]
            },
        )


def test_crear_parte_rechaza_otra_novedad_para_empleado_con_licencia(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(db_session)

    with pytest.raises(ValueError, match="no admite otra novedad"):
        parte_diario_crud.create(
            db_session,
            {
                "idproyecto": proyecto.id,
                "contacto_id": contacto.id,
                "fecha": "2026-10-12",
                "estado": "borrador",
                "detalles": [
                    {
                        "idnomina": empleado.id,
                        "idestado": None,
                        "horas": 9,
                        "descripcion": "Carga manual",
                    }
                ],
            },
        )


def test_agente_carga_licencia_como_interna_y_bloquea_operaciones(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    draft = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
    )

    error = aplicar_fecha(
        db_session,
        draft,
        "2026-10-11",
        cargar_estados(db_session),
    )

    assert error is None
    assert len(draft.novedades_internas) == 1
    assert draft.novedades_internas[0].nomina_licencia_id == licencia.id
    assert "Licencia - Enfermedad" in renderer.resumen(draft)
    assert "Certificado medico" in renderer.resumen(draft)
    persona = NominaItem(
        idnomina=empleado.id,
        nombre=empleado.nombre,
        apellido=empleado.apellido,
        idproyecto=proyecto.id,
    )
    result = execute_plan(
        draft,
        TurnPlan(
            operations=[
                ParteDiarioOperation(
                    type="agregar_novedad",
                    idnomina=empleado.id,
                    nombre="Ana Perez",
                    estado_codigo="P",
                    horas=9,
                )
            ]
        ),
        [persona],
        [persona],
        cargar_estados(db_session),
    )

    assert not result.next_state.novedades
    assert "licencia" in result.reply.lower()
    assert "no admite otra novedad" in result.reply.lower()

    sin_novedades = execute_plan(
        draft,
        TurnPlan(operations=[ParteDiarioOperation(type="sin_novedades")]),
        [persona],
        [persona],
        cargar_estados(db_session),
    )
    assert sin_novedades.status == "confirmation_required"
    assert "licencia" in sin_novedades.reply.lower()


def test_agente_recupera_jornada_personalizada_del_parte(db_session):
    proyecto, contacto, _, _ = _seed_licencia_context(db_session, con_licencia=False)
    parte = ParteDiario(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fecha=date(2026, 10, 12),
        jornada=Decimal("7.50"),
        estado="borrador",
    )
    db_session.add(parte)
    db_session.commit()
    draft = ParteDiarioDraft(
        oportunidad_id=1,
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
    )

    error = aplicar_fecha(
        db_session,
        draft,
        "2026-10-12",
        cargar_estados(db_session),
    )

    assert error is None
    assert draft.parte_id == parte.id
    assert draft.jornada == 7.5


def test_persistencia_agente_materializa_licencia_y_rechaza_reemplazo(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    base_result = {
        "type": "parte_diario_reply",
        "parte_listo": True,
        "confirmar_parte": False,
        "cerrar_parte": False,
        "idproyecto": proyecto.id,
        "contacto_id": contacto.id,
        "fecha": "2026-10-11",
        "sin_novedades_informado": True,
        "novedades": [],
        "pendientes_ambiguos": [],
        "conflictos_novedad": [],
    }

    parte = parte_diario_service._create_or_update_from_result(
        db_session,
        base_result,
        mensaje_id=None,
    )
    db_session.flush()
    detalle = db_session.exec(
        select(ParteDiarioDetalle).where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()
    assert detalle.nomina_licencia_id == licencia.id

    reemplazo = dict(base_result)
    reemplazo["parte_id_existente"] = parte.id
    reemplazo["novedades"] = [
        {
            "idnomina": empleado.id,
            "idestado": detalle.idestado,
            "estado_codigo": "ENF",
            "horas": 0,
        }
    ]
    with pytest.raises(ValueError, match="Solo se admite una novedad"):
        parte_diario_service._create_or_update_from_result(
            db_session,
            reemplazo,
            mensaje_id=None,
        )


def test_nomina_licencia_rechaza_periodos_superpuestos(db_session):
    _, _, empleado, _ = _seed_licencia_context(db_session)

    with pytest.raises(ValueError, match="se superpone"):
        nomina_licencia_crud.create(
            db_session,
            {
                "nomina_id": empleado.id,
                "tipo_novedad": "VAC",
                "fecha_desde": "2026-10-15",
                "fecha_hasta": "2026-10-20",
            },
        )


def test_crear_licencia_pide_confirmacion_y_reemplaza_novedad_abierta(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(
        db_session,
        con_licencia=False,
    )
    parte = ParteDiario(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fecha=date(2026, 10, 11),
        estado="borrador",
    )
    db_session.add(parte)
    db_session.flush()
    novedad = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=empleado.id,
        horas=9,
        descripcion="Novedad manual",
    )
    db_session.add(novedad)
    db_session.commit()

    payload = {
        "nomina_id": empleado.id,
        "tipo_novedad": "ENF",
        "fecha_desde": "2026-10-11",
        "fecha_hasta": "2026-10-12",
    }
    validacion = nomina_licencia_crud.validar_guardado(db_session, payload)
    assert validacion.requiere_confirmacion is True
    assert validacion.novedades_conflictivas[0].detalle_id == novedad.id
    assert validacion.impacto[0].accion == "reemplazar"
    assert validacion.impacto[0].parte_diario_id == parte.id

    with pytest.raises(ValueError, match="Confirme su reemplazo"):
        nomina_licencia_crud.create(db_session, payload)

    licencia = nomina_licencia_crud.create(
        db_session,
        {**payload, "_reemplazar_novedades": True},
    )
    detalle = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.parte_diario_id == parte.id)
    ).one()
    assert detalle.nomina_licencia_id == licencia.id
    assert float(detalle.horas) == 0
    assert detalle.descripcion.startswith("Licencia: ENFERMEDAD")


def test_crear_licencia_rechaza_cobertura_con_tarja_cerrada(db_session):
    proyecto, contacto, empleado, _ = _seed_licencia_context(
        db_session,
        con_licencia=False,
    )
    tarja = Tarja(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fechainicio=date(2026, 10, 1),
        fechafinal=date(2026, 10, 15),
        estado=EstadoTarja.CERRADO,
    )
    db_session.add(tarja)
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=empleado.id,
            fecha_desde=date(2026, 10, 1),
            fecha_hasta=date(2026, 10, 15),
        )
    )
    db_session.commit()

    with pytest.raises(ValueError, match="tarjas cerradas"):
        nomina_licencia_crud.create(
            db_session,
            {
                "nomina_id": empleado.id,
                "tipo_novedad": "ENF",
                "fecha_desde": "2026-10-10",
                "fecha_hasta": "2026-10-12",
            },
        )

    assert db_session.exec(select(NominaLicencia)).all() == []


def test_editar_y_eliminar_licencia_resincroniza_partes_abiertos(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    licencia.fecha_hasta = date(2026, 10, 12)
    db_session.add(licencia)
    for fecha in (date(2026, 10, 10), date(2026, 10, 11)):
        db_session.add(
            ParteDiario(
                idproyecto=proyecto.id,
                contacto_id=contacto.id,
                fecha=fecha,
                estado="borrador",
            )
        )
    db_session.commit()

    licencia = nomina_licencia_crud.update(
        db_session,
        licencia.id,
        {"fecha_desde": "2026-10-11", "fecha_hasta": "2026-10-12"},
    )
    detalles = db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.nomina_licencia_id == licencia.id)
    ).all()
    assert len(detalles) == 1
    parte = db_session.get(ParteDiario, detalles[0].parte_diario_id)
    assert parte.fecha == date(2026, 10, 11)

    impacto_eliminacion = nomina_licencia_crud.validar_eliminacion(
        db_session,
        licencia.id,
    )
    assert [(item.accion, item.parte_diario_id) for item in impacto_eliminacion.impacto] == [
        ("eliminar", parte.id)
    ]
    assert nomina_licencia_crud.delete(db_session, licencia.id) is True
    assert db_session.exec(
        select(ParteDiarioDetalle)
        .where(ParteDiarioDetalle.nomina_licencia_id == licencia.id)
    ).all() == []


def test_tarja_cerrada_permite_acortar_fin_sin_afectarla_y_bloquea_inicio_y_baja(
    db_session,
):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    licencia.fecha_desde = date(2026, 10, 1)
    licencia.fecha_hasta = date(2026, 10, 15)
    tarja = Tarja(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fechainicio=date(2026, 10, 1),
        fechafinal=date(2026, 10, 15),
        estado=EstadoTarja.CERRADO,
    )
    db_session.add_all([licencia, tarja])
    db_session.flush()
    db_session.add(
        TarjaNomina(
            tarja_id=tarja.id,
            nomina_id=empleado.id,
            fecha_desde=date(2026, 10, 5),
            fecha_hasta=date(2026, 10, 10),
        )
    )
    db_session.commit()

    actualizada = nomina_licencia_crud.update(
        db_session,
        licencia.id,
        {"fecha_hasta": "2026-10-12"},
    )
    assert actualizada.fecha_hasta == date(2026, 10, 12)

    with pytest.raises(ValueError, match="tarjas cerradas"):
        nomina_licencia_crud.update(
            db_session,
            licencia.id,
            {"fecha_desde": "2026-10-02"},
        )

    with pytest.raises(ValueError, match="tarjas cerradas"):
        nomina_licencia_crud.update(
            db_session,
            licencia.id,
            {"tipo_novedad": "ACC"},
        )

    with pytest.raises(HTTPException, match="tarjas cerradas"):
        nomina_licencia_crud.delete(db_session, licencia.id)


def test_cambiar_tipo_actualiza_detalle_y_conserva_fk_licencia(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "estado": "borrador",
            "detalles": [],
        },
    )
    detalle_original = db_session.exec(
        select(ParteDiarioDetalle).where(
            ParteDiarioDetalle.parte_diario_id == parte.id
        )
    ).one()
    detalle_id = int(detalle_original.id)

    actualizada = nomina_licencia_crud.update(
        db_session,
        licencia.id,
        {"tipo_novedad": "ACC"},
    )

    detalle = db_session.get(ParteDiarioDetalle, detalle_id)
    estado_accidente = _estado_licencia(db_session, "ACC")
    assert actualizada.id == licencia.id
    assert actualizada.tipo_novedad == "ACC"
    assert detalle.nomina_licencia_id == licencia.id
    assert detalle.idestado == estado_accidente.id
    assert detalle.descripcion.startswith("Licencia: ACCIDENTE")


def test_impacto_distingue_periodo_y_detalles_sin_cambios(db_session, monkeypatch):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    parte = parte_diario_crud.create(
        db_session,
        {
            "idproyecto": proyecto.id,
            "contacto_id": contacto.id,
            "fecha": "2026-10-11",
            "estado": "borrador",
            "detalles": [],
        },
    )

    sin_cambios = nomina_licencia_crud.validar_guardado(
        db_session,
        {
            "id": licencia.id,
            "nomina_id": empleado.id,
            "tipo_novedad": licencia.tipo_novedad,
            "fecha_desde": "2026-10-10",
            "fecha_hasta": None,
            "comentario": licencia.comentario,
        },
        obj_id=licencia.id,
    )
    assert [(item.accion, item.parte_diario_id) for item in sin_cambios.impacto] == [
        ("sin_cambios", parte.id)
    ]

    cambio_periodo = nomina_licencia_crud.validar_guardado(
        db_session,
        {
            "id": licencia.id,
            "nomina_id": empleado.id,
            "tipo_novedad": licencia.tipo_novedad,
            "fecha_desde": "2026-10-09",
            "fecha_hasta": None,
            "comentario": licencia.comentario,
        },
        obj_id=licencia.id,
    )
    assert [(item.accion, item.parte_diario_id) for item in cambio_periodo.impacto] == [
        ("actualizar_periodo", parte.id)
    ]
    assert cambio_periodo.impacto[0].descripcion_nueva.startswith(
        "Licencia: ENFERMEDAD - Periodo 09/10"
    )

    partes_resincronizados = []
    monkeypatch.setattr(
        nomina_licencia_service,
        "_sincronizar_tarjas_abiertas",
        lambda _session, partes: partes_resincronizados.extend(list(partes)),
    )
    nomina_licencia_crud.update(
        db_session,
        licencia.id,
        {
            "tipo_novedad": licencia.tipo_novedad,
            "fecha_desde": "2026-10-10",
            "fecha_hasta": None,
            "comentario": licencia.comentario,
        },
    )
    assert partes_resincronizados == []


def test_resincronizacion_desvincula_detalle_antes_de_eliminarlo(db_session):
    proyecto, contacto, empleado, licencia = _seed_licencia_context(db_session)
    licencia.fecha_hasta = date(2026, 10, 12)
    estado_licencia = _estado_licencia(db_session)
    parte = ParteDiario(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fecha=date(2026, 10, 10),
        estado="confirmado",
    )
    tarja = Tarja(
        idproyecto=proyecto.id,
        contacto_id=contacto.id,
        fechainicio=date(2026, 9, 26),
        fechafinal=date(2026, 10, 10),
        estado=EstadoTarja.BORRADOR,
    )
    db_session.add_all([licencia, parte, tarja])
    db_session.flush()
    detalle = ParteDiarioDetalle(
        parte_diario_id=parte.id,
        idnomina=empleado.id,
        idestado=estado_licencia.id,
        nomina_licencia_id=licencia.id,
        horas=0,
        descripcion="Licencia",
    )
    db_session.add(detalle)
    db_session.flush()
    db_session.add_all(
        [
            TarjaNomina(
                tarja_id=tarja.id,
                nomina_id=empleado.id,
                fecha_desde=date(2026, 9, 26),
                fecha_hasta=date(2026, 10, 10),
            ),
            TarjaDetalle(
                tarja_id=tarja.id,
                idnomina=empleado.id,
                fecha=parte.fecha,
                idestado=estado_licencia.id,
                horas=0,
                descripcion="Licencia",
                parte_diario_detalle_id=detalle.id,
            ),
        ]
    )
    db_session.commit()
    detalle_id = int(detalle.id)

    nomina_licencia_crud.update(
        db_session,
        licencia.id,
        {"fecha_desde": "2026-10-11"},
    )

    assert db_session.get(ParteDiarioDetalle, detalle_id) is None
    db_session.expire_all()
    tarja_detalle = db_session.exec(
        select(TarjaDetalle)
        .where(TarjaDetalle.tarja_id == tarja.id)
        .where(TarjaDetalle.fecha == parte.fecha)
        .where(TarjaDetalle.idnomina == empleado.id)
    ).one()
    assert tarja_detalle.parte_diario_detalle_id is None
    assert float(tarja_detalle.horas) == 6
