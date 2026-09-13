"""Unit test risk_manager: sizing reuse identik + circuit breaker + batas konkurensi + config validation."""

import pytest

from backtest.strategy import position_size as strat_size
from risk_manager.guards import CircuitBreaker, can_open_position, position_size, validate_config


def test_sizing_reuse_identik_dengan_strategy():
    # Satu source of truth: hasil harus persis sama (anti-drift dua implementasi).
    assert position_size(1000, 100, 95, 1.0) == strat_size(1000, 100, 95, 1.0)
    assert position_size is strat_size


def test_can_open_position():
    assert can_open_position(4, 5) is True
    assert can_open_position(5, 5) is False


def test_breaker_trip_di_threshold():
    cb = CircuitBreaker(initial_equity=1000, threshold_pct=15.0)
    assert cb.check(900) == "ok"          # DD 10%
    assert cb.check(850) == "tripped"     # DD 15% pas
    assert cb.trip_equity == 850


def test_breaker_lengket_sampai_reset_manual():
    cb = CircuitBreaker(initial_equity=1000, threshold_pct=15.0)
    cb.check(800)
    assert cb.check(1200) == "tripped"    # recovery tidak auto-resume
    cb.reset()
    assert cb.check(1200) == "ok"


def test_breaker_baseline_baru_opsional():
    cb = CircuitBreaker(initial_equity=1000, threshold_pct=15.0)
    cb.check(800)
    cb.reset(new_baseline=800)
    assert cb.check(800) == "ok"
    assert cb.check(680) == "tripped"     # 15% dari 800


def test_breaker_validasi_input():
    with pytest.raises(ValueError):
        CircuitBreaker(initial_equity=0)
    with pytest.raises(ValueError):
        CircuitBreaker(initial_equity=1000, threshold_pct=0)


# ── validate_config ────────────────────────────────────────────

def _cfg(**kw) -> dict:
    """Minimal valid config builder."""
    return {
        "strategy": {
            "pairs": ["BTC/USDT"],
            "donchian_entry_period": 20,
            "donchian_exit_period": 10,
            "atr_period": 14,
            "atr_stop_multiplier": 2.0,
            "direction": "long_only",
            "max_positions_per_cluster": 2,
        },
        "risk": {
            "risk_per_trade_pct": 1.0,
            "max_concurrent_positions": 5,
            "max_drawdown_circuit_breaker_pct": 15.0,
        },
        "backtest": {
            "initial_capital_usd": 1000,
            "fee_pct": 0.1,
            "slippage_pct": 0.05,
        },
        "execution": {"mode": "paper", "exchange": "bitget"},
        "paper_trading": {"data_source": "bitget"},
        "llm_filter": {"enabled": False},
    } | kw


def test_validate_config_ok():
    errs = validate_config(_cfg())
    assert errs == []


def test_validate_config_atr_stop_multiplier_nol():
    errs = validate_config(_cfg(strategy={"pairs": ["X"], "direction": "long_only", "atr_stop_multiplier": 0, "max_positions_per_cluster": 2}))
    assert any("atr_stop_multiplier" in e for e in errs)


def test_validate_config_direction_bukan_long_only():
    errs = validate_config(_cfg(strategy={"pairs": ["X"], "direction": "long_short", "atr_stop_multiplier": 2, "max_positions_per_cluster": 2}))
    assert any("direction" in e for e in errs)


def test_validate_config_risk_melebihi_1():
    errs = validate_config(_cfg(risk={"risk_per_trade_pct": 2.0, "max_concurrent_positions": 5, "max_drawdown_circuit_breaker_pct": 15.0}))
    assert any("risk_per_trade_pct" in e for e in errs)


def test_validate_config_circuit_breaker_0():
    errs = validate_config(_cfg(risk={"risk_per_trade_pct": 1.0, "max_concurrent_positions": 5, "max_drawdown_circuit_breaker_pct": 0}))
    assert any("circuit_breaker" in e.lower() for e in errs)


def test_validate_config_mode_live_ditolak():
    errs = validate_config(_cfg(execution={"mode": "live", "exchange": "bitget"}))
    assert any("live" in e.lower() and "belum" in e.lower() for e in errs)


def test_validate_config_exchange_bukan_bitget():
    errs = validate_config(_cfg(execution={"mode": "paper", "exchange": "binance"}))
    assert any("bitget" in e.lower() for e in errs)
