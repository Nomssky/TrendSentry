"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DONCHIAN_TEMPLATE_NAME } from "@/lib/deployment-config"
import { Alert, FormField, Stepper } from "@/app/components/ui"

type Template = {
  id: number
  name: string
  description: string
  params_schema: {
    properties: Record<string, {
      type: string
      default?: unknown
      enum?: string[]
      minimum?: number
      maximum?: number
      description?: string
    }>
  }
}

function humanLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function SchemaField({ name, schema, value, onChange }: {
  name: string
  schema: Template["params_schema"]["properties"][string]
  value: unknown
  onChange: (v: unknown) => void
}) {
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50"
  const help =
    schema.description ??
    (schema.minimum !== undefined && schema.maximum !== undefined
      ? `Range ${schema.minimum}–${schema.maximum}`
      : undefined)

  if (schema.enum) {
    return (
      <FormField label={humanLabel(name)} help={help}>
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {schema.enum.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </FormField>
    )
  }

  if (schema.type === "number" || schema.type === "integer") {
    return (
      <FormField label={humanLabel(name)} help={help}>
        <input
          type="number"
          step={schema.type === "integer" ? "1" : "0.1"}
          min={schema.minimum}
          max={schema.maximum}
          value={String(value ?? "")}
          onChange={(e) => {
            const v = e.target.value
            if (v === "") { onChange(undefined); return }
            onChange(schema.type === "integer" ? parseInt(v) : parseFloat(v))
          }}
          className={inputClass}
        />
      </FormField>
    )
  }

  if (schema.type === "string") {
    return (
      <FormField label={humanLabel(name)} help={help}>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </FormField>
    )
  }

  return null
}

const STEPS = ["Choose strategy", "Configure", "Review"]

export default function NewStrategyPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/templates")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setTemplates(await r.json())
      })
      .catch(() => setLoadError("Could not load strategy templates. Check your connection and try again."))
  }, [])

  const selectedTemplate = templates.find((t) => t.id === selected)

  // Isi default params saat template berganti (render-time adjustment — tanpa effect).
  const [prevTemplate, setPrevTemplate] = useState(selectedTemplate)
  if (selectedTemplate !== prevTemplate) {
    setPrevTemplate(selectedTemplate)
    if (selectedTemplate) {
      const defaults: Record<string, unknown> = {}
      for (const [key, schema] of Object.entries(selectedTemplate.params_schema.properties)) {
        if (schema.default !== undefined) defaults[key] = schema.default
      }
      setParams(defaults)
    }
  }

  const canContinueFromChoose = selected != null && name.trim().length > 0

  async function handleCreate() {
    if (!canContinueFromChoose || !selectedTemplate) {
      setError("Choose a template and name your strategy first.")
      setStep(0)
      return
    }
    setBusy(true)
    setError(null)
    let res: Response
    try {
      res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), template_id: selectedTemplate.id, params }),
      })
    } catch {
      setBusy(false)
      setError("Network problem — check your connection and try again.")
      return
    }
    if (!res.ok) {
      let msg = `Could not save the strategy (HTTP ${res.status}).`
      try {
        const j = await res.json()
        if (j && typeof j.error === "string" && j.error) msg = j.error
      } catch { /* non-JSON — pakai pesan default */ }
      setBusy(false)
      setError(msg)
      return
    }
    router.push("/app/strategies")
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-white">New strategy</h1>
        <Alert tone="error">{loadError}</Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">New strategy</h1>
        <p className="mt-1 text-sm text-white/50">
          Your rules live here. TrendSentry checks every fill against them — or runs a Donchian
          strategy automatically as a bot.
        </p>
      </div>
      <Stepper steps={STEPS} current={step} />

      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="space-y-5">
          <FormField
            label="Strategy name"
            help="Anything recognizable — e.g. My Donchian."
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My strategy"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50"
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((t) => {
              const executable = t.name === DONCHIAN_TEMPLATE_NAME
              const active = selected === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-5 text-left transition ${
                    active
                      ? "border-[#ccff00] bg-[#ccff00]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-white">{t.name}</h2>
                    {executable ? (
                      <span className="shrink-0 rounded-full bg-[#ccff00]/15 px-2 py-0.5 text-[10px] font-medium uppercase text-[#ccff00]">
                        Can run
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-white/50">
                        Tracking only
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{t.description}</p>
                  {!executable && (
                    <p className="mt-2 text-[11px] text-white/30">
                      Discipline tracking only — automatic execution supports Donchian for now.
                    </p>
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => (canContinueFromChoose ? setStep(1) : setError("Choose a template and name your strategy first."))}
            className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00]"
          >
            Continue →
          </button>
          {!canContinueFromChoose && (
            <p className="text-center text-xs text-white/30">Pick a template and name it to continue.</p>
          )}
        </div>
      )}

      {step === 1 && selectedTemplate && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-medium text-white">
              {selectedTemplate.name} <span className="text-white/40">· “{name.trim()}”</span>
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Object.entries(selectedTemplate.params_schema.properties).map(([key, schema]) => (
                <SchemaField
                  key={key}
                  name={key}
                  schema={schema}
                  value={params[key]}
                  onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 hover:text-white"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00]"
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {step === 2 && selectedTemplate && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="font-medium text-white">Review</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Name</dt>
                <dd className="text-white">{name.trim()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Template</dt>
                <dd className="text-white">{selectedTemplate.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/40">Can run automatically</dt>
                <dd className="text-white">
                  {selectedTemplate.name === DONCHIAN_TEMPLATE_NAME ? "Yes — as a paper-trading bot" : "No — discipline tracking only"}
                </dd>
              </div>
              {Object.entries(params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-white/40">{humanLabel(k)}</dt>
                  <dd className="font-mono-tech text-white">{String(v ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-relaxed text-white/40">
            Account guardrails always apply: every order needs a stop loss, no leverage, no
            martingale. Creating a strategy never places orders.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 hover:text-white"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="flex-1 rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create strategy"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
