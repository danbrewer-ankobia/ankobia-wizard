"use client";

import { ANTHROPIC_PROVIDER_ID, makeModelRef, type ModelInfo } from "@/lib/models";
import type { AdminSettingsUpdate, AdminSettingsView, Effort } from "@/lib/settings";
import { useEffect, useState } from "react";
import { PasswordInput } from "../PasswordInput";

// AI settings: pick a provider, enter its API key, then configure it.
// Only Claude is live today; the other entries show what's planned.

interface ProviderOption {
  id: string;
  name: string;
  available: boolean;
  blurb: string;
  keyHelp?: string;
  keyPlaceholder?: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: ANTHROPIC_PROVIDER_ID,
    name: "Claude (Anthropic)",
    available: true,
    blurb: "Strong writing and reasoning, reads PDFs and images directly.",
    keyHelp: "Create a key in the Claude Console: console.anthropic.com → Settings → API keys.",
    keyPlaceholder: "sk-ant-…",
  },
  { id: "openai", name: "ChatGPT (OpenAI)", available: false, blurb: "" },
  { id: "gemini", name: "Gemini (Google)", available: false, blurb: "" },
  { id: "in-house", name: "Ankobia in-house AI", available: false, blurb: "" },
];

const EFFORT_OPTIONS: { value: Effort; label: string; detail: string }[] = [
  { value: "low", label: "Quick", detail: "Fastest and cheapest. Fine for short, simple items." },
  { value: "medium", label: "Balanced", detail: "Good quality at a reasonable speed. Recommended." },
  { value: "high", label: "Thorough", detail: "Thinks longer for the best result. Slower and costs more." },
];

type TestResult = { ok: boolean; message: string } | "running";

export function ModelsPanel() {
  const [view, setView] = useState<AdminSettingsView | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [provider, setProvider] = useState(ANTHROPIC_PROVIDER_ID);

  const [newKey, setNewKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMessage, setKeyMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [effort, setEffort] = useState<Effort>("medium");

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);

  function apply(v: AdminSettingsView) {
    setView(v);
    setEnabled(v.anthropic.enabledModels);
    setDefaultModel(v.defaultModel);
    setEffort(v.anthropic.effort);
    setDirty(false);
  }

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((body: { settings: AdminSettingsView; claudeModels: ModelInfo[] }) => {
        setModels(body.claudeModels);
        apply(body.settings);
      });
  }, []);

  if (!view) return <p className="text-muted">Loading…</p>;

  const selected = PROVIDERS.find((p) => p.id === provider)!;
  const edit = () => {
    setDirty(true);
    setMessage(null);
  };
  const refFor = (modelId: string) => makeModelRef(ANTHROPIC_PROVIDER_ID, modelId);
  const enabledModels = models.filter((m) => enabled.includes(m.id));
  const effectiveDefault = enabledModels.some((m) => refFor(m.id) === defaultModel)
    ? defaultModel
    : enabledModels[0]
      ? refFor(enabledModels[0].id)
      : "";

  function toggleModel(id: string) {
    setEnabled(enabled.includes(id) ? enabled.filter((m) => m !== id) : [...enabled, id]);
    edit();
  }

  async function save() {
    if (view!.anthropic.hasApiKey && enabledModels.length === 0) {
      setMessage({ ok: false, text: "Turn on at least one model." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const update: AdminSettingsUpdate = {
      anthropic: { enabledModels: enabled, effort },
      defaultModel: effectiveDefault || defaultModel,
    };
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      apply(body.settings);
      setMessage({ ok: true, text: "Saved. Changes are live in the wizard." });
    } else {
      setMessage({ ok: false, text: body.error ?? "Couldn't save." });
    }
  }

  // Saves or removes only the key; the configuration below keeps its own
  // unsaved edits and is saved with the bar at the bottom.
  async function putKey(change: { apiKey?: string; clearApiKey?: boolean }): Promise<boolean> {
    setKeyBusy(true);
    setKeyMessage(null);
    setTest(null);
    const update: AdminSettingsUpdate = {
      anthropic: { ...change, enabledModels: view!.anthropic.enabledModels, effort: view!.anthropic.effort },
      defaultModel: view!.defaultModel,
    };
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const body = await res.json().catch(() => ({}));
    setKeyBusy(false);
    if (!res.ok) {
      setKeyMessage({ ok: false, text: body.error ?? "Couldn't save the key." });
      return false;
    }
    setView(body.settings);
    return true;
  }

  async function saveKey() {
    if (await putKey({ apiKey: newKey.trim() })) {
      setNewKey("");
      setKeyMessage({ ok: true, text: "Key saved. Now test the connection." });
    }
  }

  async function removeSavedKey() {
    if (!confirm("Remove the saved Claude API key? The wizard stops working until a new key is added.")) return;
    if (await putKey({ clearApiKey: true })) setKeyMessage({ ok: true, text: "Key removed." });
  }

  async function runTest() {
    setTest("running");
    setKeyMessage(null);
    const res = await fetch("/api/admin/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: ANTHROPIC_PROVIDER_ID }),
    });
    setTest(await res.json().catch(() => ({ ok: false, message: "Test failed." })));
  }

  const keyStatus = view.anthropic.keySource === "settings" ? (
    <span>
      Key saved: <code className="rounded bg-canvas px-1.5 py-0.5">{view.anthropic.apiKeyHint}</code>
    </span>
  ) : view.anthropic.keySource === "env" ? (
    <span className="text-muted">Using the key from the server&apos;s .env.local file. Enter one here to override it.</span>
  ) : (
    <span className="text-amber-800">No key yet. The wizard can&apos;t generate anything until one is added.</span>
  );

  return (
    <div className="space-y-6">
      {/* Step 1: provider */}
      <section className="card space-y-3">
        <StepHeading n={1} title="Choose an AI" />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
          <div>
            <label className="label" htmlFor="provider">
              AI provider
            </label>
            <select id="provider" className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.name}
                  {p.available ? "" : " (coming soon)"}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm sm:mt-6">
            <p className="text-ink">{selected.blurb}</p>
            <p className="mt-1 text-muted">More AI options, including ChatGPT, Gemini and our own in-house AI, are planned.</p>
          </div>
        </div>
      </section>

      {/* Step 2: API key */}
      <section className="card space-y-3">
        <StepHeading n={2} title={`${selected.name} API key`} />
        <p className="text-sm">{keyStatus}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="sm:w-96">
            <label className="sr-only" htmlFor="api-key">
              API key
            </label>
            <PasswordInput
              id="api-key"
              autoComplete="off"
              spellCheck={false}
              placeholder={view.anthropic.keySource === "settings" ? "Paste a new key to replace it" : selected.keyPlaceholder}
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value);
                setKeyMessage(null);
                setTest(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && newKey.trim() && !keyBusy && saveKey()}
            />
          </div>
          <button type="button" className="btn-primary py-2" onClick={saveKey} disabled={!newKey.trim() || keyBusy}>
            {keyBusy ? "Saving…" : "Save key"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={runTest}
            disabled={!view.anthropic.hasApiKey || Boolean(newKey.trim()) || keyBusy || test === "running"}
          >
            {test === "running" ? "Testing…" : "Test connection"}
          </button>
          {view.anthropic.keySource === "settings" && (
            <button type="button" className="btn-danger" onClick={removeSavedKey} disabled={keyBusy}>
              Remove key
            </button>
          )}
        </div>
        <p className="help">
          {selected.keyHelp} Save the key, then test the connection. Saved keys are encrypted on the server and never shown
          again.
        </p>
        {keyMessage && (
          <p className={`rounded-lg px-3 py-2 text-sm ${keyMessage.ok ? "bg-mint/25 text-navy" : "bg-red-50 text-red-800"}`}>
            {keyMessage.text}
          </p>
        )}
        {test && test !== "running" && (
          <p className={`rounded-lg px-3 py-2 text-sm ${test.ok ? "bg-mint/25 text-navy" : "bg-red-50 text-red-800"}`}>
            {test.ok ? "✓ " : "✕ "}
            {test.message}
          </p>
        )}
      </section>

      {/* Step 3: configuration */}
      <section className="card space-y-6">
        <StepHeading n={3} title="Configuration" />

        <fieldset>
          <legend className="label">Models people can choose</legend>
          <p className="mb-3 text-sm text-muted">If you turn on more than one, people see an &quot;AI model&quot; picker in the wizard.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {models.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  enabled.includes(m.id) ? "border-teal bg-mint/15" : "border-line hover:bg-canvas"
                }`}
              >
                <input type="checkbox" className="mt-1 accent-teal" checked={enabled.includes(m.id)} onChange={() => toggleModel(m.id)} />
                <span>
                  <span className="block text-sm font-semibold text-navy">{m.label}</span>
                  <span className="block text-xs text-muted">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="sm:w-80">
          <label className="label" htmlFor="default-model">
            Default model
          </label>
          <select
            id="default-model"
            className="input"
            value={effectiveDefault}
            disabled={enabledModels.length === 0}
            onChange={(e) => {
              setDefaultModel(e.target.value);
              edit();
            }}
          >
            {enabledModels.length === 0 && <option value="">Turn on a model first</option>}
            {enabledModels.map((m) => (
              <option key={m.id} value={refFor(m.id)}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="help">Pre-selected for everyone.</p>
        </div>

        <fieldset>
          <legend className="label">Response depth</legend>
          <p className="mb-3 text-sm text-muted">How long the AI thinks before writing. Applies to every request.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {EFFORT_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  effort === o.value ? "border-teal bg-mint/15" : "border-line hover:bg-canvas"
                }`}
              >
                <input
                  type="radio"
                  name="effort"
                  className="mt-1 accent-teal"
                  checked={effort === o.value}
                  onChange={() => {
                    setEffort(o.value);
                    edit();
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-navy">{o.label}</span>
                  <span className="block text-xs text-muted">{o.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div
        className={`flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-white/95 px-5 py-3 backdrop-blur ${
          dirty ? "sticky bottom-4 shadow-md" : ""
        }`}
      >
        {message && <span className={`text-sm ${message.ok ? "text-teal" : "text-red-700"}`}>{message.text}</span>}
        {dirty && (
          <button type="button" className="btn" onClick={() => apply(view)} disabled={saving}>
            Discard changes
          </button>
        )}
        <button type="button" className="btn-primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : dirty ? "Save settings" : "Saved"}
        </button>
      </div>
    </div>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold text-navy">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-sm text-white">{n}</span>
      {title}
    </h2>
  );
}
