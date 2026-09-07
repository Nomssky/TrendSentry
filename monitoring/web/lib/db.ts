// Build-time data layer: baca db/paper_trading.db (SQLite, di-commit bot CI tiap hari)
// dan hitung semua metrik dashboard. Equity curve dibaca dari tabel equity_log
// yang ditulis engine tiap run — TANPA fetch harga saat build (dulu via Binance
// klines: rapuh + angkanya tidak persis harga eksekusi). Definisi tunggal:
// total_equity = cash + positions_mtm (yield sudah termasuk di cash).
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import path from "path";

export type Position = {
  id: number;
  pair: string;
  entry_date: string;
  entry_price: number;
  units: number;
  stop_price: number;
  risk_amount: number;
  status: string;
  exit_date: string | null;
  exit_price: number | null;
  exit_reason: string | null;
  pnl: number | null;
  r_multiple: number | null;
};

export type Signal = {
  candle_date: string;
  pair: string;
  close_price: number;
  signal: string;
  decision: string;
  reason: string | null;
  processed_at: string;
};

export type EquityPoint = { date: string; equity: number };

export type DashboardData = {
  cash: number;
  startDate: string;
  lastCandleDate: string;
  lastRun: string;
  daysRunning: number;
  gaps: string[]; // tanggal tanpa record = downtime
  openPositions: Position[];
  closedTrades: Position[];
  recentSignals: Signal[];
  nSignals: number;
  pairs: string[];
  realized: {
    nClosed: number;
    wins: number;
    winRatePct: number | null;
    avgR: number | null;
    avgWinR: number | null;
    avgLossR: number | null;
  };
  slippage: { avgPct: number | null; maxPct: number | null; n: number };
  yieldInfo: { total: number; days: number; apyAssumed: number };
  yieldDaily: { date: string; amount: number }[];
  equityCurve: EquityPoint[];
  hasSnapshots: boolean; // equity_log terisi (kurva MTM penuh) vs masih kosong
};

const DB_PATH = path.join(process.cwd(), "..", "..", "db", "paper_trading.db");

function readDb(): Omit<DashboardData, "equityCurve" | "hasSnapshots" | "daysRunning"> {
  const db = new Database(DB_PATH, { readonly: true });
  const cash = Number(
    (db.prepare("SELECT value FROM meta WHERE key='paper_cash'").get() as { value: string } | undefined)?.value ?? 1000,
  );
  const signals = db
    .prepare("SELECT candle_date, pair, close_price, signal, decision, reason, processed_at FROM signals ORDER BY candle_date DESC")
    .all() as Signal[];
  const positions = db.prepare("SELECT * FROM positions ORDER BY id DESC").all() as Position[];
  const slip = db
    .prepare("SELECT AVG(spread_pct) avgPct, MAX(spread_pct) maxPct, COUNT(*) n FROM slippage_log")
    .get() as { avgPct: number | null; maxPct: number | null; n: number };
  const yld = db
    .prepare("SELECT COALESCE(SUM(amount), 0) total, COUNT(*) days FROM yield_log")
    .get() as { total: number; days: number };
  const yieldDaily = db
    .prepare("SELECT date, amount FROM yield_log ORDER BY date")
    .all() as { date: string; amount: number }[];
  db.close();

  // APY dari config.yaml (single source of truth) — parse sederhana, tanpa dependency yaml
  let apyAssumed = 0;
  try {
    const cfg = readFileSync(path.join(process.cwd(), "..", "..", "config.yaml"), "utf8");
    const m = cfg.match(/yield_apy_idle_cash:\s*([\d.]+)/);
    if (m) apyAssumed = Number(m[1]);
  } catch {
    /* config tidak tersedia -> 0 */
  }

  const dates = [...new Set(signals.map((s) => s.candle_date))].sort();
  const startDate = dates[0] ?? new Date().toISOString().slice(0, 10);
  const lastCandleDate = dates[dates.length - 1] ?? startDate;

  // Gap = tanggal hilang di antara start..last (crypto 7 hari/minggu, tidak ada weekend)
  const gaps: string[] = [];
  let cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(lastCandleDate + "T00:00:00Z");
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    if (!dates.includes(d)) gaps.push(d);
    cur = new Date(cur.getTime() + 86_400_000);
  }

  const openPositions = positions.filter((p) => p.status === "open");
  const closedTrades = positions
    .filter((p) => p.status === "closed")
    .sort((a, b) => (a.exit_date ?? "").localeCompare(b.exit_date ?? "")).reverse();

  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const rs = closedTrades.map((t) => t.r_multiple ?? 0);
  const winRs = wins.map((t) => t.r_multiple ?? 0);
  const lossRs = closedTrades.filter((t) => (t.pnl ?? 0) < 0).map((t) => t.r_multiple ?? 0);
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  return {
    cash,
    startDate,
    lastCandleDate,
    lastRun: signals[0]?.processed_at ?? "",
    gaps,
    openPositions,
    closedTrades,
    recentSignals: signals.slice(0, 30),
    nSignals: signals.length,
    pairs: [...new Set(signals.map((s) => s.pair))].sort(),
    realized: {
      nClosed: closedTrades.length,
      wins: wins.length,
      winRatePct: closedTrades.length ? (wins.length / closedTrades.length) * 100 : null,
      avgR: avg(rs),
      avgWinR: avg(winRs),
      avgLossR: avg(lossRs),
    },
    slippage: { avgPct: slip.avgPct, maxPct: slip.maxPct, n: slip.n },
    yieldInfo: { total: yld.total, days: yld.days, apyAssumed },
    yieldDaily,
  };
}

// Kurva equity langsung dari equity_log (ditulis engine tiap run harian).
// Tidak ada fetch network, tidak ada rekonstruksi — angkanya persis definisi engine.
function readEquityCurve(db: InstanceType<typeof Database>): { curve: EquityPoint[]; ok: boolean } {
  const rows = db
    .prepare("SELECT date, total_equity FROM equity_log ORDER BY date")
    .all() as { date: string; total_equity: number }[];
  return {
    curve: rows.map((r) => ({ date: r.date, equity: Math.round(r.total_equity * 100) / 100 })),
    ok: rows.length > 0,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const data = readDb();
  const daysRunning =
    Math.floor((Date.now() - new Date(data.startDate + "T00:00:00Z").getTime()) / 86_400_000) + 1;
  const db = new Database(DB_PATH, { readonly: true });
  let curve: EquityPoint[] = [];
  let ok = false;
  try {
    ({ curve, ok } = readEquityCurve(db));
  } catch {
    ok = false; // tabel belum ada (DB lama sebelum equity_log) -> kurva kosong
  } finally {
    db.close();
  }
  return { ...data, daysRunning, equityCurve: curve, hasSnapshots: ok };
}
