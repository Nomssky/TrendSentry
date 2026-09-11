"""Kontrak LLM filter (Fase 3, skeleton dogfood gratis).

Kontrak sempit, disengaja: filter hanya boleh VETO/FLAG + daftar faktor risiko
+ reasoning — tidak pernah "buy/sell". Keputusan entry tetap milik engine.
Prompt/model/threshold hidup server-side saat API berbayar tayang; CLI kelak
hanya kirim SignalContext (tanpa secret) dan mencatat verdict di log.

Selama API belum ada, evaluate() = pass transparan ("filter nonaktif").
"""

from dataclasses import asdict, dataclass

FILTER_VERSION = "v0-dogfood"  # naik tiap perubahan pipeline server-side

VERDICTS = ("pass", "veto", "flag")


@dataclass(frozen=True)
class SignalContext:
    pair: str
    close: float
    donchian_hi: float | None
    donchian_lo: float | None
    atr: float | None
    signal: str  # LONG_ENTRY | LONG_EXIT | HOLD


@dataclass(frozen=True)
class FilterVerdict:
    verdict: str  # pass | veto | flag
    risk_factors: list[str]
    reasoning: str
    version: str = FILTER_VERSION

    def __post_init__(self) -> None:
        if self.verdict not in VERDICTS:
            raise ValueError(f"verdict harus salah satu {VERDICTS}: {self.verdict!r}")

    def to_log(self) -> dict:
        return asdict(self)


def evaluate(ctx: SignalContext) -> FilterVerdict:
    """Skeleton: selalu pass + alasan jujur. Implementasi DeepSeek = Fase 3."""
    return FilterVerdict(
        verdict="pass",
        risk_factors=[],
        reasoning=f"filter nonaktif ({FILTER_VERSION}, dogfood gratis) — {ctx.pair} {ctx.signal} diteruskan tanpa penilaian",
    )
