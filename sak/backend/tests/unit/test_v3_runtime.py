from agente.v3.runtime import _outbound_count_from_inbox_result


def test_runtime_counts_multiple_outbounds_from_processed_inbox_result():
    inbox_result = {
        "processed": [
            {
                "orchestrator": {
                    "metadata": {
                        "outbound_message_ids": ["out-1", "out-2"],
                    },
                },
                "outbox": {"message_id": "out-2"},
            }
        ]
    }

    assert _outbound_count_from_inbox_result(inbox_result) == 2


def test_runtime_counts_legacy_single_outbound_without_metadata_ids():
    inbox_result = {
        "processed": [
            {
                "orchestrator": {"metadata": {}},
                "outbox": {"message_id": "out-1"},
            }
        ]
    }

    assert _outbound_count_from_inbox_result(inbox_result) == 1
