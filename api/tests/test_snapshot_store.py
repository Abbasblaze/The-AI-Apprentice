import base64
import tempfile
from pathlib import Path

import pytest

from app.repositories.snapshots import FileSnapshotStore


@pytest.fixture
def tmp_store(tmp_path: Path) -> FileSnapshotStore:
    return FileSnapshotStore(tmp_path)


def fake_jpeg() -> str:
    # Minimal valid JPEG bytes, base64-encoded
    tiny = bytes(
        [
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
        ]
    )
    return base64.b64encode(tiny).decode()


def test_save_creates_file(tmp_store: FileSnapshotStore) -> None:
    saved = tmp_store.save("sess-1", 12.345, fake_jpeg())
    assert saved is True
    p = tmp_store.path("sess-1", 12.345)
    assert p is not None and p.exists()


def test_save_does_not_overwrite(tmp_store: FileSnapshotStore) -> None:
    tmp_store.save("sess-1", 5.0, fake_jpeg())
    second = tmp_store.save("sess-1", 5.0, fake_jpeg())
    assert second is False


def test_path_returns_none_for_missing(tmp_store: FileSnapshotStore) -> None:
    assert tmp_store.path("no-such-session", 1.0) is None


def test_filename_is_three_decimal_places(tmp_store: FileSnapshotStore) -> None:
    tmp_store.save("sess-2", 99.1, fake_jpeg())
    p = tmp_store.path("sess-2", 99.1)
    assert p is not None
    assert p.name == "99.100.jpg"


def test_multiple_sessions_isolated(tmp_store: FileSnapshotStore) -> None:
    tmp_store.save("sess-A", 1.0, fake_jpeg())
    tmp_store.save("sess-B", 1.0, fake_jpeg())
    assert tmp_store.path("sess-A", 1.0) is not None
    assert tmp_store.path("sess-B", 1.0) is not None
    assert tmp_store.path("sess-A", 1.0) != tmp_store.path("sess-B", 1.0)
