"""Regresi kontrak `load_ohlcv(symbol, timeframe, cfg)` — semua pemanggil wajib cfg.

Cacatnya: commit 0ad6cc6 mengganti hardcode indikator (`donchian_high(df, 20)`)
dengan pembacaan parameter dari cfg, TETAPI default `cfg: dict | None = None`
tetap dibiarkan. Akibatnya 10 pemanggil di 5 skrip riset masih memanggil
`load_ohlcv(s, tf)` tanpa cfg — tiga di antaranya crash `KeyError:
'donchian_entry_period'` setiap kali dijalankan, dua lagi crash begitu ada
`PRESET=` aktif. Default `None` juga menyesatkan: pemanggil yang lupa cfg
meledak 3 baris di dalam fungsi, bukan di titik pemanggilannya.

Kontrak sekarang: `cfg` positional wajib (lihat tanda tangan di
`backtest/run_backtest.py`). TypeError terjadi tepat di call site.

Test ini menutup dua jalur yang tidak tertangkap bahasa:
  1. pemanggilan via keyword (`load_ohlcv(s, tf, cfg=...)`) yang nanti di-refactor
     jadi tidak sengaja kehilangan argumen;
  2. skrip riset BARU yang lupa mengoper cfg —-python tidak akan mengeluh saat
     definisinya masih punya default, dan tanpa test ini bug yang sama berulang.

Cakupan: hanya fungsi engine `load_ohlcv` (dari `backtest.run_backtest`).
`backtest/research/correlation_mitigation.py` punya loader sendiri
`load_ohlcv(symbol)` dengan parameter beku sendiri dan TIDAK diimpor dari engine
— sengaja dikecualikan, bukan ikut diperbaiki.
"""

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Modul yang mendefinisikan loader engine-nya sendiri (bukan target kontrak ini).
_SELF_DEFINED = {"backtest/research/correlation_mitigation.py"}

_ENGINE_MODULES = {"run_backtest", "backtest.run_backtest"}


def _uses_engine_loader(tree: ast.Module) -> bool:
    """True kalau file ini mengambil load_ohlcv dari modul engine."""
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module in _ENGINE_MODULES:
            if any(a.name == "load_ohlcv" for a in node.names):
                return True
        if isinstance(node, ast.Import):
            if any(a.name in _ENGINE_MODULES for a in node.names):
                return True
    return False


def _calls_without_cfg(tree: ast.Module) -> list[tuple[str, int]]:
    """Kembalikan (nama fungsi pemanggil, line) untuk tiap call load_ohlcv tanpa cfg."""
    bad: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        if name != "load_ohlcv":
            continue
        # cfg bisa|positional ATAU keyword — yang prohibited adalah tidak ada sama sekali.
        n_pos = len(node.args)
        has_cfg_kw = any(k.arg == "cfg" for k in node.keywords)
        if n_pos >= 3 or has_cfg_kw:
            continue
        caller = "?"
        for parent in ast.walk(tree):
            if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)) and node in ast.walk(parent):
                caller = parent.name
        bad.append((caller, node.lineno))
    return bad


def _research_scripts() -> list[Path]:
    """Semua .py di backtest/ kecuali yang punya loader sendiri."""
    return [
        p for p in sorted((ROOT / "backtest").rglob("*.py"))
        if p.relative_to(ROOT).as_posix() not in _SELF_DEFINED
    ]


def test_load_ohlcv_cfg_is_mandatory_in_signature():
    """Penjaga utama: `cfg` tidak boleh punya default lagi di mesin."""
    import inspect

    from backtest.run_backtest import load_ohlcv

    params = inspect.signature(load_ohlcv).parameters
    assert "cfg" in params, "load_ohlcv kehilangan parameter cfg"
    assert params["cfg"].default is inspect.Parameter.empty, (
        "load_ohlcv(cfg=...) punya default lagi — pemanggil yang lupa cfg akan "
        "melempar KeyError di dalam fungsi, bukan TypeError di titik pemanggilan"
    )


def test_no_research_script_calls_load_ohlcv_without_cfg():
    """Semua skrip yang memakai loader engine harus mengoper cfg."""
    offenders: list[str] = []
    scanned = 0

    for path in _research_scripts():
        rel = path.relative_to(ROOT).as_posix()
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        if not _uses_engine_loader(tree):
            continue
        scanned += 1
        for func_name, lineno in _calls_without_cfg(tree):
            offenders.append(f"{rel}:{lineno} (dalam {func_name}()) — load_ohlcv tanpa cfg")

    assert scanned > 0, "tidak ada skrip yang terdeteksi memakai loader engine — test ini diam"
    assert not offenders, (
        "load_ohlcv dipanggil tanpa cfg:\n  "
        + "\n  ".join(offenders)
        + "\n\nLoloskan cfg yang sudah ada di scope (lihat fungsi masing-masing)."
    )


def test_self_defined_loader_is_still_independent():
    """Loader sendiri correlation_mitigation tetap utuh (dikecualikan, bukan ikut berubah)."""
    from backtest.research.correlation_mitigation import load_ohlcv as own_loader

    import inspect

    params = inspect.signature(own_loader).parameters
    assert "cfg" not in params, (
        "correlation_mitigation.load_ohlcv ikut berubah — loader itu punya parameter "
        "beku sendiri (14/20/10) dan sengaja tidak mengikuti kontrak engine"
    )