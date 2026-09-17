from __future__ import annotations

import inspect
import sys
from pathlib import Path

from app import engine_adapter
from app.engine import risk_engine


def test_no_legacy_import_is_loaded():
    assert not any(
        module == "src" or module.startswith("src.")
        for module in sys.modules
    )


def test_intelligence_app_contains_no_legacy_bootstrap_or_imports():
    app_root = Path(__file__).resolve().parents[1] / "app"
    forbidden = (
        "legacy/python-backend-v1",
        "legacy\\python-backend-v1",
        "from src.",
        "import src.",
        "sys.path.insert",
        "sys.path.append",
        "_find_legacy_backend_root",
    )

    for path in app_root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        assert not any(token in source for token in forbidden), path


def test_adapter_is_a_thin_facade():
    source = inspect.getsource(engine_adapter)
    assert "from app.engine.risk_engine" in source
    assert "fetch_forecast_weather" not in source
    assert "fetch_historical_daily_rainfall" not in source
    assert "legacy" not in source.lower()
    assert hasattr(engine_adapter, "run_disease_analysis_from_snapshot")


def test_risk_engine_is_pure_snapshot_to_output():
    source = inspect.getsource(risk_engine)
    assert "requests" not in source
    assert "urllib" not in source
    assert "open_meteo" not in source.lower()
