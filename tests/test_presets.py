"""Check preset pack: tiap preset long-only 1D + SL wajib + parameter BEKU.

Aturan beku (2026-09-11): nilai params di file preset TIDAK BOLEH diubah untuk
mempercantik backtest. Test di bawah mengunci nilai beku secara mekanis —
siapa pun yang menggeser angka akan memerahkan suite.
"""

import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Nilai beku — salinan deklaratif dari file preset. Ubah hanya atas instruksi
# eksplisit owner + alasan tercatat di PLAN.md + backtest ulang (AGENTS.md aturan 2).
FROZEN = {
    "donchian_cluster_a2.yaml": {
        "model": None,
        "params": {"donchian_entry_period": 20, "donchian_exit_period": 10,
                   "atr_period": 14, "atr_stop_multiplier": 2.0,
                   "max_positions_per_cluster": 2},
    },
    "sma_crossover.yaml": {
        "model": "sma",
        "params": {"sma_fast_period": 20, "sma_slow_period": 50,
                   "atr_period": 14, "atr_stop_multiplier": 2.0,
                   "max_positions_per_cluster": 2},
    },
    "rsi_mean_reversion.yaml": {
        "model": "rsi",
        "params": {"rsi_period": 14, "rsi_oversold": 30, "rsi_exit": 55,
                   "atr_period": 14, "atr_stop_multiplier": 2.0,
                   "max_positions_per_cluster": 2},
    },
}


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


def test_semua_preset_guardrail():
    for name in FROZEN:
        p = load(name)
        assert p["direction"] == "long_only", name
        assert p["timeframe"] == "1d", name
        assert p["params"]["atr_stop_multiplier"] > 0, name  # SL wajib
        assert p["risk"]["risk_per_trade_pct"] <= 1.0, name
        assert p["risk"]["max_drawdown_circuit_breaker_pct"] > 0, name


def test_parameter_beku():
    for name, frozen in FROZEN.items():
        p = load(name)
        assert p.get("model", "donchian") == (frozen["model"] or "donchian"), name
        for k, v in frozen["params"].items():
            assert p["params"][k] == v, f"{name}:{k} BERUBAH — tuning dilarang (AGENTS.md aturan 2)"
