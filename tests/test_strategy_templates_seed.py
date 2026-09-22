"""Phase 2C-3: drift guard seed kanonik `strategy_templates`.

Migration = sumber eksekumen kanonik (satu-satunya salinan payload di repo);
test ini membaca file migration secara langsung — TIDAK menduplikasi payload —
dan mengunci: 8 ID/nama persis, JSON valid + guardrail, klause keamanan
(OVERIDING/ON CONFLICT/setval), dan urutan migration (forward-only).
Bekerja tanpa database (tidak menyentuh produksi).
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"
OLD_UPDATE = MIGRATIONS / "20260911120000_seed_strategy_templates.sql"
NEW_SEED = MIGRATIONS / "20260922120000_insert_builtin_strategy_templates.sql"

# Identitas kanonik 8 template built-in (id, name) — dipertahankan persis dari
# output DB yang disuplai owner.
EXPECTED = [
    (1, "Donchian Breakout"),
    (2, "SMA Crossover"),
    (3, "RSI Mean-Reversion"),
    (4, "Custom"),
    (5, "Bollinger Bands"),
    (6, "MACD Crossover"),
    (7, "Ichimoku Cloud"),
    (8, "VWAP Strategy"),
]

ROW_RE = re.compile(
    r"\((\d+), '((?:[^']|'')*)', '((?:[^']|'')*)', '(\{.*?\})'::jsonb\)",
    re.DOTALL,
)

RISK_GUARDRAIL = {"type": "number", "default": 1, "maximum": 1, "minimum": 0.1}
MAX_CONCURRENT_GUARDRAIL = {"type": "integer", "default": 5, "maximum": 5, "minimum": 1}


def _rows() -> list[dict]:
    """Ekstrak baris VALUES dari migration ( gagal keras bila format berubah )."""
    rows = ROW_RE.findall(NEW_SEED.read_text(encoding="utf-8"))
    return [
        {"id": int(i), "name": n, "description": d, "params_schema": json.loads(j)}
        for i, n, d, j in rows
    ]


def test_exact_eight_templates_ids_and_names():
    assert [(r["id"], r["name"]) for r in _rows()] == EXPECTED


def test_descriptions_present():
    for r in _rows():
        assert r["description"].strip(), f"id={r['id']} description kosong"


def test_params_schema_structure_and_guardrails():
    for r in _rows():
        schema = r["params_schema"]
        assert schema["type"] == "object" and isinstance(schema["properties"], dict)
        props = schema["properties"]
        assert props["direction"]["enum"] == ["long_only"]
        assert props["direction"]["default"] == "long_only"
        assert props["risk_per_trade_pct"] == RISK_GUARDRAIL
        assert props["max_concurrent"] == MAX_CONCURRENT_GUARDRAIL


def test_empty_string_default_preserved():
    custom = next(r for r in _rows() if r["name"] == "Custom")
    assert custom["params_schema"]["properties"]["rules_text"]["default"] == ""


def test_conflict_identity_and_sequence_safety():
    # Buang komentar `--` dulu agar kata "UPDATE" di komentar header tidak
    # terdeteksi sebagai statement UPDATE/DELETE yang dilarang.
    body = "\n".join(
        line.split("--", 1)[0]
        for line in NEW_SEED.read_text(encoding="utf-8").splitlines()
    ).lower()
    assert "on conflict (name) do nothing" in body, "tanpa ON CONFLICT → berbahaya di DB terisi"
    assert "overriding system value" in body, "ID eksplisit butuh OVERRIDING SYSTEM VALUE"
    assert "setval" in body and "pg_get_serial_sequence" in body, "sequence identity wajib disinkronkan"
    # Seed baru hanya boleh INSERT — tanpa UPDATE/DELETE pada tabel mana pun
    assert not re.search(r"\b(update|delete)\s", body), "migration seed harus forward-only INSERT"


def test_migration_history_preserved_and_ordered():
    # Migration lama (UPDATE guardrail) tetap utuh; yang baru bertimestamp lebih akhir.
    assert OLD_UPDATE.exists() and "update public.strategy_templates" in OLD_UPDATE.read_text(encoding="utf-8")
    old_ts, new_ts = OLD_UPDATE.name.split("_")[0], NEW_SEED.name.split("_")[0]
    assert old_ts < new_ts, "timestamp migration baru harus > migration guardrail lama"
