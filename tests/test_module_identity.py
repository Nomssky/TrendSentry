"""Regresi identitas modul engine — menutup cacat TREE_REFACTOR_AUDIT #1.

Cacatnya: `backtest.strategy` bisa diimpor lewat DUA jalur —
  (a) `from backtest.strategy import ...`  (paket, dipakai risk_manager + tests)
  (b) `from strategy import ...`           (modul top-level, terjadi kalau folder
      backtest/ ada di sys.path: mode skrip `python backtest/run_backtest.py`,
      research script, atau test yang menyisipkan backtest/)
Jalur (b) membuat objek modul DAN objek fungsi KEDUA dari file yang sama, jadi
`risk_manager.guards.position_size` dan `live_signal.position_size` bisa berbeda
identitas padahal satu source — re-exports "anti-drift" di guards.py jadi ilusi.

Test di bawah membuktikan jalur ganda itu tertutup, bukan menguji detail
implementasi: (1) kedua importer menunjuk objek fungsi yang sama, (2) di proses
bersih jalur legacy `strategy` tidak ada, (3) entrypoint utama tetap terimpor.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Kode yang dijalankan di proses interpreter bersih, dengan sys.path berisi
# HANYA repo root — kondisi yang sama dengan entrypoint kanonik.
_CLEAN = """
import sys
sys.path.insert(0, {root!r})
from backtest.strategy import position_size as engine_ps
from risk_manager.guards import position_size as guards_ps
assert engine_ps is guards_ps, "position_size beda identitas: engine vs guards"
import backtest.strategy as mod
assert mod.position_size is engine_ps, "re-export guards bukan objek yang sama"
assert "strategy" not in sys.modules, "jalur legacy `strategy` terimpor di proses bersih"
print("IDENTIK")
"""


def _run_clean(code: str) -> subprocess.CompletedProcess:
    """Jalankan kode di interpreter bersih dari cwd asing (di luar repo)."""
    return subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        cwd="/tmp",
        timeout=120,
    )


def test_position_size_identity_engine_vs_guards():
    """Satu fungsi = satu objek, di seluruh importer yang memakainya."""
    from backtest.strategy import position_size as engine_ps
    from risk_manager.guards import position_size as guards_ps
    import backtest.strategy as strategy_mod

    # guards.py mengklaim "re-export dari backtest.strategy, satu source of truth".
    # Kalau jalur legacy `strategy` dipakai di mana pun, objek ini terbelah.
    assert engine_ps is guards_ps
    assert strategy_mod.position_size is engine_ps


def test_no_legacy_strategy_module_in_process():
    """Tidak ada modul `strategy` top-level yang terimpor selama suite berjalan."""
    import backtest.strategy as strategy_mod

    assert "strategy" not in sys.modules, (
        "modul `strategy` (jalur lama) ikut terimpor — identitas ganda kembali muncul"
    )
    expected = (ROOT / "backtest" / "strategy.py").resolve()
    assert Path(strategy_mod.__file__).resolve() == expected


def test_clean_process_single_identity_smoke():
    """Proses interpreter bersih (cwd asing): import kanonik + identitas sama."""
    proc = _run_clean(_CLEAN.format(root=str(ROOT)))
    assert proc.returncode == 0, f"stdout={proc.stdout}\nstderr={proc.stderr}"
    assert "IDENTIK" in proc.stdout


def test_clean_process_legacy_route_is_gone():
    """Di proses bersih, `import strategy` harus GAGAL — jalur kedua tidak ada."""
    code = (
        "import sys\n"
        f"sys.path.insert(0, {str(ROOT)!r})\n"
        "try:\n"
        "    import strategy\n"
        "except ModuleNotFoundError:\n"
        "    print('TIDAK ADA')\n"
        "else:\n"
        "    raise SystemExit('jalur legacy strategy masih terbuka: ' + strategy.__file__)\n"
    )
    proc = _run_clean(code)
    assert proc.returncode == 0, f"stdout={proc.stdout}\nstderr={proc.stderr}"
    assert "TIDAK ADA" in proc.stdout


def test_backtest_entrypoint_importable_in_clean_process():
    """Entry point utama terimpor lewat identitas kanonik — dalam DUA mode jalan.

    (a) mode paket:  `import backtest.run_backtest`
    (b) mode skrip:  `python backtest/run_backtest.py` → sys.path[0] = folder backtest/.
        Inilah mode yang dulu membuat modul `strategy` kedua; skrip memasukkan ROOT
        sendiri lebih dulu, jadi `backtest.strategy` tetap satu-satunya identitas.
    """
    scenarios = {
        "paket": (
            "import sys\n"
            f"sys.path.insert(0, {str(ROOT)!r})\n"
            "import backtest.run_backtest as rb\n"
        ),
        "skrip": (
            "import sys\n"
            # meniru `python backtest/run_backtest.py`: folder backtest/ di sys.path[0],
            # repo root BELUM ada di sys.path sampai modulnya sendiri memasukkannya.
            f"sys.path.insert(0, {str(ROOT / 'backtest')!r})\n"
            "assert not any(p.rstrip('/').endswith('/home/kresna/project') for p in sys.path[1:])\n"
            "import run_backtest as rb\n"
        ),
    }
    tail = (
        "import backtest.strategy as st\n"
        "assert rb.position_size is st.position_size, 'position_size beda identitas'\n"
        "assert 'strategy' not in sys.modules, 'jalur legacy strategy terimpor'\n"
        "print('ENTRYPOINT OK')\n"
    )
    for label, code in scenarios.items():
        proc = _run_clean(code + tail)
        assert proc.returncode == 0, f"[{label}] stdout={proc.stdout}\\nstderr={proc.stderr}"
        assert "ENTRYPOINT OK" in proc.stdout, f"[{label}] {proc.stdout}"
