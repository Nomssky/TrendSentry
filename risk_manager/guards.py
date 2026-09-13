"""Guard Fase 4 (PREP): sizing reuse dari strategy + circuit breaker + validasi terpusat.

- position_size: re-export dari backtest.strategy (satu source of truth, anti-drift).
- CircuitBreaker: Drawdown dari modal awal >= threshold -> trip; resume HANYA manual.
  Pure (tanpa I/O) supaya bisa unit-test penuh sebelum menyentuh uang.
- validate_config: satu fungsi yang dicek DI AWAL semua entry point (paper, live, backtest).
"""

from dataclasses import dataclass, field

from backtest.strategy import position_size  # noqa: F401 - re-export, source of truth tunggal

__all__ = ["position_size", "CircuitBreaker", "can_open_position", "validate_config"]


def validate_config(cfg: dict) -> list[str]:
    """Validasi config startup. Return list error (kosong = OK).

    Dipanggil DI AWAL semua entry point (paper, backtest, CLI doctor) —
    bukan hanya di doctor. Misconfig ketahuan segera, bukan besok pagi.
    """
    errors: list[str] = []
    s = cfg.get("strategy", {})
    r = cfg.get("risk", {})
    b = cfg.get("backtest", {})
    e = cfg.get("execution", {})
    p = cfg.get("paper_trading", {})

    if s.get("atr_stop_multiplier", 0) <= 0:
        errors.append("strategy.atr_stop_multiplier harus > 0 (stop loss wajib)")
    if s.get("direction") != "long_only":
        errors.append("strategy.direction harus 'long_only' (short dicoret berbasis riset)")
    if not s.get("pairs"):
        errors.append("strategy.pairs tidak boleh kosong")
    if not isinstance(s.get("pairs"), list):
        errors.append("strategy.pairs harus list")

    rpt = r.get("risk_per_trade_pct", 0)
    if not 0 < rpt <= 1.0:
        errors.append(f"risk.risk_per_trade_pct harus 0..1% (value={rpt})")
    mcp = r.get("max_concurrent_positions", 0)
    if not 1 <= mcp <= 5:
        errors.append(f"risk.max_concurrent_positions harus 1..5 (value={mcp})")
    mdcb = r.get("max_drawdown_circuit_breaker_pct", 0)
    if mdcb <= 0:
        errors.append("risk.max_drawdown_circuit_breaker_pct harus > 0 (circuit breaker wajib)")
    elif mdcb > 50:
        errors.append(f"risk.max_drawdown_circuit_breaker_pct terlalu besar ({mdcb}%) — maks 50%")
    mppc = s.get("max_positions_per_cluster", 0)
    if not 1 <= mppc <= 5:
        errors.append(f"strategy.max_positions_per_cluster harus 1..5 (value={mppc})")

    mode = e.get("mode", "")
    if mode not in ("backtest", "paper", "live"):
        errors.append(f"execution.mode harus backtest/paper/live (value={mode!r})")
    if mode == "live":
        errors.append("execution.mode='live' — Fase 4 belum tersedia, pakai 'paper'")
    if e.get("exchange", "") != "bitget":
        errors.append("execution.exchange harus 'bitget' (venue tunggal)")

    ds = p.get("data_source", "")
    if ds and ds != "bitget":
        errors.append("paper_trading.data_source hanya 'bitget' yang didukung")

    fee = b.get("fee_pct", -1)
    if fee < 0 or fee > 5:
        errors.append(f"backtest.fee_pct harus 0..5% (value={fee})")
    slip = b.get("slippage_pct", -1)
    if slip < 0 or slip > 2:
        errors.append(f"backtest.slippage_pct harus 0..2% (value={slip})")

    return errors


def can_open_position(n_open: int, max_concurrent: int) -> bool:
    """Boleh buka posisi baru hanya jika di bawah batas konkurensi."""
    return n_open < max_concurrent


@dataclass
class CircuitBreaker:
    """Auto-pause saat drawdown dari modal awal menyentuh threshold.

    Pecah sekali -> tetap trip sampai reset() eksplisit dipanggil manusia.
    """

    initial_equity: float
    threshold_pct: float = 15.0
    tripped: bool = field(default=False, init=False)
    trip_equity: float | None = field(default=None, init=False)

    def __post_init__(self) -> None:
        if self.initial_equity <= 0:
            raise ValueError("initial_equity harus positif")
        if not 0 < self.threshold_pct < 100:
            raise ValueError("threshold_pct harus 0..100")

    def drawdown_pct(self, equity: float) -> float:
        return (self.initial_equity - equity) / self.initial_equity * 100.0

    def check(self, equity: float) -> str:
        """Return 'ok' | 'tripped'. Sekali trip, tetap trip sampai reset()."""
        if self.tripped:
            return "tripped"
        if self.drawdown_pct(equity) >= self.threshold_pct:
            self.tripped = True
            self.trip_equity = equity
            return "tripped"
        return "ok"

    def reset(self, new_baseline: float | None = None) -> None:
        """Resume manual. Baseline opsional di-reset (mis. setelah review)."""
        self.tripped = False
        self.trip_equity = None
        if new_baseline is not None:
            if new_baseline <= 0:
                raise ValueError("baseline harus positif")
            self.initial_equity = new_baseline
