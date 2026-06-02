from datetime import UTC, datetime, timedelta

import pytest

from agente.v2.core.turn_lease import AgentTurnLeaseBusy, AgentTurnLeaseService
from agente.v2.db.models import AgentConversationState


def test_turn_lease_blocks_same_opportunity_while_active(db_session):
    token = AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)

    with pytest.raises(AgentTurnLeaseBusy):
        AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)

    AgentTurnLeaseService.release(db_session, oportunidad_id=1, token=token)


def test_turn_lease_can_be_acquired_after_release(db_session):
    first = AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)
    AgentTurnLeaseService.release(db_session, oportunidad_id=1, token=first)

    second = AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)

    assert second != first


def test_turn_lease_can_be_acquired_after_expiration(db_session):
    first = AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)
    row = db_session.get(AgentConversationState, 1)
    row.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.add(row)
    db_session.commit()

    second = AgentTurnLeaseService.acquire(db_session, oportunidad_id=1)

    assert second != first
