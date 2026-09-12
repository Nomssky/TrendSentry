"""Unit test risk_manager: sizing reuse identik + circuit breaker + batas konkurensi."""

import pytest

from backtest.strategy import position_size as strat_size
from risk_manager.guards import CircuitBreaker, can_open_position, position_size


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
