"""Guard Fase 4 (PREP): sizing reuse dari strategy + circuit breaker murni.

- position_size: re-export dari backtest.strategy (satu source of truth, anti-drift).
- CircuitBreaker: Drawdown dari modal awal >= threshold -> trip; resume HANYA manual.
  Pure (tanpa I/O) supaya bisa unit-test penuh sebelum menyentuh uang.
"""

from dataclasses import dataclass, field

from backtest.strategy import position_size  # noqa: F401 - re-export, source of truth tunggal

__all__ = ["position_size", "CircuitBreaker", "can_open_position"]


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
