from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
import agente.v3.subprocesses.pedido_obra.handler as pedido_obra_handler
from agente.v3.subprocesses.pedido_obra.handler import PedidoObraSubprocess
from agente.v3.subprocesses.pedido_obra.interpreter import PedidoObraOperation
from agente.v3.subprocesses.pedido_obra.state import PedidoObraItem
from app.models import CRMContacto, CRMOportunidad, Proyecto, User
from app.models.constructora.pedido import (
    ConstructoraPedido,
    ConstructoraPedidoDetalle,
    PedidoObraDetalleEstado,
    PedidoObraEstado,
    PedidoObraOrigen,
)


class FakeCargaLLM:
    async def interpret_carga(self, message, state):
        return [
            PedidoObraOperation(type="insert", descripcion="cemento", cantidad=10, unidad="bolsas"),
            PedidoObraOperation(type="insert", descripcion="hierro del 12", cantidad=5, unidad="barras"),
        ], 12


def _message(text: str, *, from_address: str = "from", external_message_id: str = "external-1") -> V3InboundMessage:
    return V3InboundMessage(
        id="msg-1",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="conv-1",
        external_message_id=external_message_id,
        from_address=from_address,
        to_address="to",
        text=text,
        message_type="text",
        raw_payload={},
        normalized_payload={},
    )


@pytest.mark.asyncio
async def test_pedido_obra_v3_carga_usa_plan_llm_y_backend_aplica_estado():
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    context = V3ConversationContext(
        conversation_id="conv-1",
        process_state={
            "etapa": "carga",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
        },
    )
    result = await process.handle(_message("necesito cemento y hierro"), context)

    assert result.context.active_process == "pedidoObra"
    assert result.context.process_state["etapa"] == "carga"
    assert result.context.process_state["items"] == [
        {"item_id": result.context.process_state["items"][0]["item_id"], "descripcion": "cemento", "cantidad": 10, "unidad": "bolsas"},
        {"item_id": result.context.process_state["items"][1]["item_id"], "descripcion": "hierro del 12", "cantidad": 5, "unidad": "barras"},
    ]
    assert result.metadata["interpreter"] == "llm"
    assert result.metadata["llm_ms"] == 12
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (result.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_cerrar_usa_confirmacion_ok_volver():
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    item = PedidoObraItem(descripcion="cemento", cantidad=10, unidad="bolsas")
    context = V3ConversationContext(
        conversation_id="conv-1",
        active_process="pedidoObra",
        process_state={
            "etapa": "carga",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
            "items": [item.to_dict()],
        },
    )

    result = await process.handle(_message("2"), context)

    assert result.context.process_state["etapa"] == "cierre"
    assert result.context.process_state["accion_pendiente"] == "cerrar"
    assert "Pedido para cerrar:" in (result.reply_text or "")
    assert "Opciones: 1:OK 2:VOLVER." in (result.reply_text or "")
    assert "CONFIRMAR" not in (result.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_salida_usa_confirmacion_ok_volver():
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    item = PedidoObraItem(descripcion="cemento", cantidad=10, unidad="bolsas")
    context = V3ConversationContext(
        conversation_id="conv-1",
        active_process="pedidoObra",
        process_state={
            "etapa": "carga",
            "contacto_id": 1,
            "oportunidad_id": 10,
            "proyecto_id": 20,
            "items": [item.to_dict()],
        },
    )

    confirmation = await process.handle(_message("3"), context)
    discarded = await process.handle(_message("1"), confirmation.context)

    assert confirmation.context.process_state["etapa"] == "confirmar_salida"
    assert "Se perderan los cambios no guardados." in (confirmation.reply_text or "")
    assert "Opciones: 1:OK 2:VOLVER." in (confirmation.reply_text or "")
    assert "cemento" not in (confirmation.reply_text or "")
    assert discarded.context.active_process is None
    assert "Pedido descartado" in (discarded.reply_text or "")


@pytest.fixture()
def seeded_pedido_obra_v3(db_session: Session, monkeypatch):
    monkeypatch.setattr(pedido_obra_handler, "engine", db_session.bind)
    user = User(nombre="Tester", email="pedido-v3@example.com")
    db_session.add(user)
    db_session.flush()
    contact = CRMContacto(
        nombre_completo="Encargado",
        telefonos=["549111111"],
        responsable_id=user.id,
    )
    db_session.add(contact)
    db_session.flush()
    opportunity = CRMOportunidad(contacto_id=contact.id, responsable_id=user.id, activo=True)
    db_session.add(opportunity)
    db_session.flush()
    project = Proyecto(nombre="Obra Centro", responsable_id=user.id, oportunidad_id=opportunity.id)
    db_session.add(project)
    db_session.commit()
    return {
        "contact": contact,
        "opportunity": opportunity,
        "project": project,
    }


def _add_pedido(
    session: Session,
    seeded,
    *,
    estado: PedidoObraEstado,
    created_at: datetime,
    descripcion: str,
) -> ConstructoraPedido:
    pedido = ConstructoraPedido(
        oportunidad_id=seeded["opportunity"].id,
        contacto_id=seeded["contact"].id,
        estado=estado,
        origen=PedidoObraOrigen.AGENTE,
        titulo=f"Pedido {descripcion}",
        created_at=created_at,
    )
    session.add(pedido)
    session.flush()
    session.add(
        ConstructoraPedidoDetalle(
            pedido_id=pedido.id,
            descripcion_original=descripcion,
            descripcion=descripcion,
            cantidad=Decimal("10"),
            cantidad_original=Decimal("10"),
            unidad_medida="bolsas",
            estado=PedidoObraDetalleEstado.ACTIVA,
            orden=0,
        )
    )
    session.commit()
    return pedido


@pytest.mark.asyncio
async def test_pedido_obra_v3_command_lists_last_ten_orders_any_status(db_session: Session, seeded_pedido_obra_v3):
    now = datetime.now(UTC)
    draft = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.BORRADOR,
        created_at=now - timedelta(days=20),
        descripcion="cemento",
    )
    recent_closed = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.CERRADO,
        created_at=now - timedelta(days=2),
        descripcion="arena",
    )
    old_closed = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.CERRADO,
        created_at=now - timedelta(days=20),
        descripcion="hierro",
    )
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())

    result = await process.handle(
        _message("Pedido obra", from_address="549111111"),
        V3ConversationContext(conversation_id="conv-pedidos"),
    )

    assert result.context.active_process == "pedidoObra"
    assert result.context.process_state["etapa"] == "seleccionar_pedido"
    assert f"Pedido #{draft.id}" in (result.reply_text or "")
    assert f"Pedido #{recent_closed.id}" in (result.reply_text or "")
    assert f"Pedido #{old_closed.id}" in (result.reply_text or "")
    assert "NUEVO o SALIR" in (result.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_select_borrador_recovers_items(db_session: Session, seeded_pedido_obra_v3):
    now = datetime.now(UTC)
    draft = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.BORRADOR,
        created_at=now,
        descripcion="cemento",
    )
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())

    menu = await process.handle(
        _message("Pedido obra", from_address="549111111"),
        V3ConversationContext(conversation_id="conv-pedidos"),
    )
    selected = await process.handle(_message("1"), menu.context)

    assert selected.context.process_state["etapa"] == "carga"
    assert selected.context.process_state["pedido_id"] == draft.id
    assert selected.context.process_state["items"][0]["descripcion"] == "cemento"
    assert "Pedido borrador recuperado:" in (selected.reply_text or "")
    assert "Opciones: 1:GUARDAR 2:CERRAR 3:SALIR." in (selected.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_salir_de_borrador_vuelve_a_lista_pedidos(
    db_session: Session,
    seeded_pedido_obra_v3,
):
    now = datetime.now(UTC)
    draft = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.BORRADOR,
        created_at=now,
        descripcion="cemento",
    )
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())

    menu = await process.handle(
        _message("Pedido obra", from_address="549111111"),
        V3ConversationContext(conversation_id="conv-pedidos"),
    )
    selected = await process.handle(_message("1", from_address="549111111"), menu.context)
    exited = await process.handle(_message("3", from_address="549111111"), selected.context)

    assert selected.context.process_state["etapa"] == "carga"
    assert selected.context.process_state["pedido_id"] == draft.id
    assert exited.context.active_process == "pedidoObra"
    assert exited.context.process_state["etapa"] == "seleccionar_pedido"
    assert exited.context.process_state["pedido_id"] is None
    assert f"Pedido #{draft.id}" in (exited.reply_text or "")
    assert "Responde con el numero de un pedido, NUEVO o SALIR" in (exited.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_pedido_cerrado_no_permite_modificar_y_sale_con_3(
    db_session: Session,
    seeded_pedido_obra_v3,
):
    now = datetime.now(UTC)
    closed_order = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.CERRADO,
        created_at=now,
        descripcion="cemento",
    )
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())

    menu = await process.handle(
        _message("Pedido obra", from_address="549111111"),
        V3ConversationContext(conversation_id="conv-pedidos"),
    )
    selected = await process.handle(_message("1", from_address="549111111"), menu.context)
    rejected = await process.handle(_message("agregar arena", from_address="549111111"), selected.context)
    exited = await process.handle(_message("3", from_address="549111111"), rejected.context)

    assert selected.context.process_state["etapa"] == "pedido_readonly"
    assert selected.context.process_state["pedido_id"] == closed_order.id
    assert selected.context.process_state["pedido_estado"] == PedidoObraEstado.CERRADO.value
    assert f"Pedido #{closed_order.id} (cerrado):" in (selected.reply_text or "")
    assert "El pedido no se puede modificar 3:SALIR" in (selected.reply_text or "")
    assert rejected.context.process_state["etapa"] == "pedido_readonly"
    assert rejected.reply_text == "El pedido no se puede modificar 3:SALIR"
    assert exited.context.active_process == "pedidoObra"
    assert exited.context.process_state["etapa"] == "seleccionar_pedido"
    assert exited.context.process_state["pedido_id"] is None
    assert f"Pedido #{closed_order.id}" in (exited.reply_text or "")
    assert "Responde con el numero de un pedido, NUEVO o SALIR" in (exited.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_cerrar_borrador_seleccionado_actualiza_mismo_pedido(
    db_session: Session,
    seeded_pedido_obra_v3,
):
    now = datetime.now(UTC)
    draft = _add_pedido(
        db_session,
        seeded_pedido_obra_v3,
        estado=PedidoObraEstado.BORRADOR,
        created_at=now,
        descripcion="cal",
    )
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())

    menu = await process.handle(
        _message("Pedido obra", from_address="549111111"),
        V3ConversationContext(conversation_id="conv-pedidos"),
    )
    selected = await process.handle(_message("1", from_address="549111111"), menu.context)
    confirmation = await process.handle(_message("2", from_address="549111111"), selected.context)
    closed = await process.handle(
        _message("1", from_address="549111111", external_message_id="external-close-selected"),
        confirmation.context,
    )

    db_session.expire_all()
    pedido = db_session.get(ConstructoraPedido, draft.id)
    pedidos = db_session.exec(
        select(ConstructoraPedido).where(
            ConstructoraPedido.oportunidad_id == seeded_pedido_obra_v3["opportunity"].id
        )
    ).all()
    active_details = db_session.exec(
        select(ConstructoraPedidoDetalle)
        .where(ConstructoraPedidoDetalle.pedido_id == draft.id)
        .where(ConstructoraPedidoDetalle.deleted_at.is_(None))
        .where(ConstructoraPedidoDetalle.estado == PedidoObraDetalleEstado.ACTIVA)
    ).all()

    assert closed.metadata["pedido_obra_id"] == draft.id
    assert f"Pedido #{draft.id}" in (closed.reply_text or "")
    assert pedido is not None
    assert pedido.estado == PedidoObraEstado.CERRADO
    assert len(pedidos) == 1
    assert len(active_details) == 1
    assert active_details[0].descripcion == "cal"
    assert closed.context.active_process == "pedidoObra"
    assert closed.context.process_state["etapa"] == "seleccionar_pedido"
    assert closed.context.process_state["pedido_id"] is None
    assert "Responde con el numero de un pedido, NUEVO o SALIR" in (closed.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_guardar_crea_borrador(db_session: Session, seeded_pedido_obra_v3):
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    item = PedidoObraItem(descripcion="cemento", cantidad=10, unidad="bolsas")
    context = V3ConversationContext(
        conversation_id="conv-save",
        active_process="pedidoObra",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_pedido_obra_v3["contact"].id,
            "oportunidad_id": seeded_pedido_obra_v3["opportunity"].id,
            "proyecto_id": seeded_pedido_obra_v3["project"].id,
            "items": [item.to_dict()],
        },
    )

    confirmation = await process.handle(_message("1", from_address="549111111"), context)
    saved = await process.handle(
        _message("1", from_address="549111111", external_message_id="external-save-ok"),
        confirmation.context,
    )
    pedido = db_session.get(ConstructoraPedido, saved.metadata["pedido_obra_id"])

    assert confirmation.context.process_state["accion_pendiente"] == "guardar"
    assert "Pedido para guardar:" in (confirmation.reply_text or "")
    assert pedido is not None
    assert pedido.estado == PedidoObraEstado.BORRADOR
    assert "*PEDIDO GUARDADO*" in (saved.reply_text or "")
    assert saved.metadata["status"] == "saved"
    assert saved.context.active_process == "pedidoObra"
    assert saved.context.process_state["etapa"] == "seleccionar_pedido"
    assert saved.context.process_state["pedido_id"] is None
    assert "Responde con el numero de un pedido, NUEVO o SALIR" in (saved.reply_text or "")


@pytest.mark.asyncio
async def test_pedido_obra_v3_cerrar_crea_cerrado(db_session: Session, seeded_pedido_obra_v3):
    process = PedidoObraSubprocess(llm_client=FakeCargaLLM())
    item = PedidoObraItem(descripcion="cemento", cantidad=10, unidad="bolsas")
    context = V3ConversationContext(
        conversation_id="conv-close",
        active_process="pedidoObra",
        process_state={
            "etapa": "carga",
            "contacto_id": seeded_pedido_obra_v3["contact"].id,
            "oportunidad_id": seeded_pedido_obra_v3["opportunity"].id,
            "proyecto_id": seeded_pedido_obra_v3["project"].id,
            "items": [item.to_dict()],
        },
    )

    confirmation = await process.handle(_message("2", from_address="549111111"), context)
    closed = await process.handle(
        _message("1", from_address="549111111", external_message_id="external-close-ok"),
        confirmation.context,
    )
    pedido = db_session.get(ConstructoraPedido, closed.metadata["pedido_obra_id"])

    assert confirmation.context.process_state["accion_pendiente"] == "cerrar"
    assert "Pedido para cerrar:" in (confirmation.reply_text or "")
    assert pedido is not None
    assert pedido.estado == PedidoObraEstado.CERRADO
    assert "*PEDIDO CERRADO*" in (closed.reply_text or "")
    assert closed.metadata["status"] == "closed"
    assert closed.context.active_process == "pedidoObra"
    assert closed.context.process_state["etapa"] == "seleccionar_pedido"
    assert closed.context.process_state["pedido_id"] is None
    assert "Responde con el numero de un pedido, NUEVO o SALIR" in (closed.reply_text or "")
