from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.schemas import WorkMap


def _make_work_map(
    session_id: str = "sess-001",
    expert_confirmed: bool = False,
    demo_ready: bool = False,
) -> WorkMap:
    return WorkMap(
        session_id=session_id,
        process_name="Test Process",
        steps=[],
        expert_confirmed=expert_confirmed,
        demo_ready=demo_ready,
    )


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


class TestListLearnMaps:
    def test_returns_empty_when_no_maps(self, client: TestClient):
        mock_repo = MagicMock()
        mock_repo.list_sessions.return_value = []
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps")
        assert response.status_code == 200
        assert response.json() == []

    def test_excludes_unconfirmed_maps(self, client: TestClient):
        from app.schemas import SessionSummary

        session = MagicMock()
        session.session_id = "sess-001"
        session.has_map = True

        mock_repo = MagicMock()
        mock_repo.list_sessions.return_value = [session]
        mock_repo.load_map.return_value = _make_work_map(
            "sess-001", expert_confirmed=False, demo_ready=False
        )
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps")
        assert response.status_code == 200
        assert response.json() == []

    def test_includes_confirmed_map(self, client: TestClient):
        session = MagicMock()
        session.session_id = "sess-002"
        session.has_map = True

        mock_repo = MagicMock()
        mock_repo.list_sessions.return_value = [session]
        mock_repo.load_map.return_value = _make_work_map(
            "sess-002", expert_confirmed=True, demo_ready=False
        )
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["session_id"] == "sess-002"
        assert data[0]["expert_confirmed"] is True


class TestGetLearnMap:
    def test_returns_404_for_missing_map(self, client: TestClient):
        mock_repo = MagicMock()
        mock_repo.load_map.return_value = None
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps/nonexistent")
        assert response.status_code == 404

    def test_returns_403_for_unconfirmed_map(self, client: TestClient):
        mock_repo = MagicMock()
        mock_repo.load_map.return_value = _make_work_map(
            "sess-003", expert_confirmed=False, demo_ready=False
        )
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps/sess-003")
        assert response.status_code == 403

    def test_returns_map_when_confirmed(self, client: TestClient):
        mock_repo = MagicMock()
        mock_repo.load_map.return_value = _make_work_map(
            "sess-004", expert_confirmed=True, demo_ready=False
        )
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps/sess-004")
        assert response.status_code == 200
        assert response.json()["session_id"] == "sess-004"

    def test_returns_map_when_demo_ready(self, client: TestClient):
        mock_repo = MagicMock()
        mock_repo.load_map.return_value = _make_work_map(
            "sess-005", expert_confirmed=False, demo_ready=True
        )
        client.app.state.session_repo = mock_repo

        response = client.get("/api/learn/maps/sess-005")
        assert response.status_code == 200
        assert response.json()["session_id"] == "sess-005"
