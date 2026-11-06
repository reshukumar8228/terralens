"""Small, bounded experiment journal. Scientific reference results remain immutable."""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ExperimentStore:
    """Open a connection per operation so worker and request threads do not share one."""

    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "experiments.sqlite3"
        self.lock = threading.Lock()
        with self._connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS experiments "
                "(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, "
                "status TEXT NOT NULL, stage TEXT NOT NULL, config TEXT NOT NULL, result TEXT, error TEXT)"
            )
            # A process restart cannot resume a Python thread. Keep an honest record.
            db.execute(
                "UPDATE experiments SET status='failed', stage='Interrupted by restart', "
                "error='The server restarted. Run this experiment again.' "
                "WHERE status IN ('queued', 'running')"
            )

    @contextmanager
    def _connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def _decode(row: sqlite3.Row, include_result: bool = True) -> dict[str, Any]:
        value = dict(row)
        value["config"] = json.loads(value["config"])
        if include_result and value["result"]:
            value["result"] = json.loads(value["result"])
        else:
            value.pop("result", None)
        if value.get("error") is None:
            value.pop("error", None)
        return value

    def create(self, experiment_id: str, config: dict) -> None:
        now = utc_now()
        with self.lock, self._connect() as db:
            db.execute(
                "INSERT INTO experiments VALUES (?,?,?,?,?,?,?,?)",
                (experiment_id, now, now, "queued", "Waiting for the numerical worker", json.dumps(config), None, None),
            )
            # Retain at most 50 completed/failed experiments, never delete active jobs.
            db.execute(
                "DELETE FROM experiments WHERE id IN (SELECT id FROM experiments "
                "WHERE status IN ('completed','failed') ORDER BY created_at DESC LIMIT -1 OFFSET 50)"
            )

    def update(self, experiment_id: str, status: str, stage: str, result: dict | None = None, error: str | None = None):
        encoded = json.dumps(result, allow_nan=False) if result is not None else None
        with self.lock, self._connect() as db:
            db.execute(
                "UPDATE experiments SET updated_at=?,status=?,stage=?,result=?,error=? WHERE id=?",
                (utc_now(), status, stage, encoded, error, experiment_id),
            )

    def get(self, experiment_id: str) -> dict | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM experiments WHERE id=?", (experiment_id,)).fetchone()
        return self._decode(row) if row else None

    def list(self) -> list[dict]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50").fetchall()
        return [self._decode(row, include_result=False) for row in rows]

    def active_count(self) -> int:
        with self._connect() as db:
            return int(db.execute("SELECT COUNT(*) FROM experiments WHERE status IN ('queued','running')").fetchone()[0])
