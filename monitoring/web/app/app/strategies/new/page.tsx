"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

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

function SchemaField({ name, schema, value, onChange }: {
  name: string
  schema: Template["params_schema"]["properties"][string]
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (schema.enum) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">{name.replace(/_/g, " ")}</label>
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50">
          {schema.enum.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    )
  }

  if (schema.type === "number" || schema.type === "integer") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
          {name.replace(/_/g, " ")}
          {schema.minimum !== undefined && schema.maximum !== undefined && (
            <span className="ml-1 text-white/30">({schema.minimum}–{schema.maximum})</span>
          )}
        </label>
        <input
          type="number"
          step={schema.type === "integer" ? "1" : "0.1"}
          min={schema.minimum}
          max={schema.maximum}
          value={String(value ?? "")}
          onChange={(e) => onChange(schema.type === "integer" ? parseInt(e.target.value) : parseFloat(e.target.value))}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50"
        />
      </div>
    )
  }

  if (schema.type === "string") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">{name.replace(/_/g, " ")}</label>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#ccff00]/50"
        />
      </div>
    )
  }

  return null
}

export default function NewStrategyPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates)
  }, [])

  const selectedTemplate = templates.find((t) => t.id === selected)

  useEffect(() => {
    if (selectedTemplate) {
      const defaults: Record<string, unknown> = {}
      for (const [key, schema] of Object.entries(selectedTemplate.params_schema.properties)) {
        if (schema.default !== undefined) defaults[key] = schema.default
      }
      setParams(defaults)
    }
  }, [selectedTemplate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !name) return
    const res = await fetch("/api/strategies", {
      method: "POST",
      body: JSON.stringify({ name, template_id: selected, params }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json()
      return setError(msg)
    }
    router.push("/app/strategies")
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-white">New Strategy</h1>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Strategy name" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t.id)} className={`rounded-2xl border p-5 text-left transition ${selected === t.id ? "border-[#ccff00] bg-[#ccff00]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
              <h2 className="font-semibold text-white">{t.name}</h2>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{t.description}</p>
            </button>
          ))}
        </div>
        {selectedTemplate && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <h3 className="font-medium text-white">Parameters</h3>
            <div className="grid gap-4 md:grid-cols-2">
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
        )}
        <button type="submit" disabled={!selected || !name} className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-40">Create strategy</button>
      </form>
    </div>
  )
}
