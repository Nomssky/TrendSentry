"""Bootstrap jalur import repo untuk SELURUH suite pytest.

Sebelum file ini ada, ketersediaan repo-root di `sys.path` bergantung pada
urutan koleksi: `tests/test_filter.py` menyisipkan ROOT saat di-import, jadi
test yang berdiri sendiri (`pytest tests/test_strategy.py`) gagal dengan
`ModuleNotFoundError: No module named 'backtest'`. Conftest di-import pytest
SEBELUM modul test dikoleksi → ROOT selalu tersedia, apa pun urutannya, dari
direktori kerja manapun.

Catatan: kebutuhan path per-modul yang spesifik (`scripts/`, `paper_trading/`,
`backtest/`) tetap dikelola modul masing-masing — conftest hanya menjamin ROOT.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
