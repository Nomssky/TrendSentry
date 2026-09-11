"""Check preset pack: tiap preset long-only 1D + SL wajib + konsisten dgn config.yaml."""

import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(name: str) -> dict:
    return yaml.safe_load((ROOT / "presets" / name).read_text())


def test_donchian_preset_guardrails():
    p = load("donchian_cluster_a2.yaml")
    assert p["direction"] == "long_only"
    assert p["timeframe"] == "1d"
    assert p["params"]["atr_stop_multiplier"] > 0  # SL wajib
    assert p["risk"]["risk_per_trade_pct"] <= 1.0
    assert p["risk"]["max_drawdown_circuit_breaker_pct"] > 0


def test_donchian_preset_matches_config():
    p = load("donchian_cluster_a2.yaml")
    cfg = yaml.safe_load((ROOT / "config.yaml").read_text())
    for k, v in p["params"].items():
        assert cfg["strategy"][k] == v, k
    assert p["pairs"] == cfg["strategy"]["pairs"]
    assert p["risk"]["risk_per_trade_pct"] == cfg["risk"]["risk_per_trade_pct"]
