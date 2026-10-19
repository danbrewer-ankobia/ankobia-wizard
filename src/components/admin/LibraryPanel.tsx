"use client";

import type { GuidedField, PromptItem, PromptLibrary } from "@/prompts/types";
import { useEffect, useState } from "react";

type Selection = { kind: "system" } | { kind: "item"; index: number };

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

function uniqueId(base: string, taken: string[]): string {
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

const NEW_ITEM: PromptItem = {
  id: "new-item",
  label: "new item",
  article: "a",
  summary: "Describe what the user will get.",
  materialsHint: "",
  fields: [],
  template: "Create a …\n\nAudience: {{audience}}\n\nGuidelines:\n1. …\n\nOutput format: Markdown.",
};

export function LibraryPanel() {
  const [library, setLibrary] = useState<PromptLibrary | null>(null);
  const [customized, setCustomized] = useState(false);
  const [selected, setSelected] = useState<Selection>({ kind: "item", index: 0 });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function apply(body: { library: PromptLibrary; customized: boolean }) {
    setLibrary({ systemPrompt: body.library.systemPrompt, items: body.library.items });
    setCustomized(body.customized);
    setDirty(false);
  }

  useEffect(() => {
    fetch("/api/admin/library")
      .then((r) => r.json())
      .then(apply);
  }, []);

  if (!library) return <p className="text-muted">Loading…</p>;

  const change = (next: PromptLibrary) => {
    setLibrary(next);
    setDirty(true);
    setMessage(null);
  };

  const updateItem = (index: number, patch: Partial<PromptItem>) =>
    change({ ...library, items: library.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  function addItem() {
    const id = uniqueId(NEW_ITEM.id, library!.items.map((i) => i.id));
    change({ ...library!, items: [...library!.items, { ...NEW_ITEM, id }] });
    setSelected({ kind: "item", index: library!.items.length });
  }

  function deleteItem(index: number) {
    const item = library!.items[index];
    if (!confirm(`Delete "${item.label}"? People will no longer see it in the wizard after you save.`)) return;
    change({ ...library!, items: library!.items.filter((_, i) => i !== index) });
    setSelected({ kind: "item", index: Math.max(0, index - 1) });
  }

  function moveItem(index: number, dir: -1 | 1) {
    change({ ...library!, items: move(library!.items, index, index + dir) });
    setSelected({ kind: "item", index: Math.min(Math.max(index + dir, 0), library!.items.length - 1) });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(library),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      apply(body);
      setMessage({ ok: true, text: "Saved. Changes are live in the wizard." });
    } else {
      setMessage({ ok: false, text: body.error ?? "Couldn't save." });
    }
  }

  async function reset() {
    if (!confirm("Reset the whole prompt library to the built-in defaults? Your edits will be lost.")) return;
    const res = await fetch("/api/admin/library", { method: "DELETE" });
    if (res.ok) {
      apply(await res.json());
      setSelected({ kind: "item", index: 0 });
      setMessage({ ok: true, text: "Library reset to defaults." });
    }
  }

  const current = selected.kind === "item" ? library.items[selected.index] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {customized ? "You're using an edited library." : "You're using the built-in default library."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {message && <span className={`text-sm ${message.ok ? "text-teal" : "text-red-700"}`}>{message.text}</span>}
          {customized && (
            <button type="button" className="btn-danger" onClick={reset}>
              Reset to defaults
            </button>
          )}
          <button type="button" className="btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : dirty ? "Save library" : "Saved"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Item list */}
        <nav className="card h-fit space-y-1 p-3 sm:p-3">
          <button
            type="button"
            onClick={() => setSelected({ kind: "system" })}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
              selected.kind === "system" ? "bg-mint/30 text-navy" : "text-muted hover:bg-canvas"
            }`}
          >
            ⚙️ House rules (system prompt)
          </button>
          <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">I want to make…</p>
          {library.items.map((it, i) => (
            <div
              key={i}
              className={`group flex items-center rounded-lg ${selected.kind === "item" && selected.index === i ? "bg-mint/30" : "hover:bg-canvas"}`}
            >
              <button
                type="button"
                onClick={() => setSelected({ kind: "item", index: i })}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm font-medium text-navy"
              >
                {it.label || "(untitled)"}
              </button>
              <button type="button" aria-label="Move up" className="px-1 text-muted hover:text-navy disabled:opacity-30" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                className="px-1 pr-2 text-muted hover:text-navy disabled:opacity-30"
                disabled={i === library.items.length - 1}
                onClick={() => moveItem(i, 1)}
              >
                ↓
              </button>
            </div>
          ))}
          <button type="button" className="btn mt-2 w-full" onClick={addItem}>
            + Add item
          </button>
        </nav>

        {/* Editor */}
        {selected.kind === "system" ? (
          <section className="card space-y-3">
            <h2 className="text-lg font-bold text-navy">House rules</h2>
            <p className="text-sm text-muted">
              Sent as the system prompt with every request, for every item. Use it for rules that always apply: tone, accuracy,
              formatting, company conventions.
            </p>
            <textarea
              aria-label="System prompt"
              className="input min-h-96 font-mono text-xs leading-relaxed"
              value={library.systemPrompt}
              onChange={(e) => change({ ...library, systemPrompt: e.target.value })}
            />
          </section>
        ) : current ? (
          <ItemEditor
            key={selected.index}
            item={current}
            takenIds={library.items.filter((_, i) => i !== selected.index).map((i) => i.id)}
            onChange={(patch) => updateItem(selected.index, patch)}
            onDelete={() => deleteItem(selected.index)}
            canDelete={library.items.length > 1}
          />
        ) : null}
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  takenIds,
  onChange,
  onDelete,
  canDelete,
}: {
  item: PromptItem;
  takenIds: string[];
  onChange: (patch: Partial<PromptItem>) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const placeholders = [...item.template.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g)].map((m) => m[1]);
  const fieldIds = item.fields.map((f) => f.id);
  const unknown = [...new Set(placeholders.filter((p) => !fieldIds.includes(p)))];
  const unused = fieldIds.filter((id) => !placeholders.includes(id));
  const idTaken = takenIds.includes(item.id);

  const setField = (index: number, field: GuidedField) => onChange({ fields: item.fields.map((f, i) => (i === index ? field : f)) });

  function addField() {
    const id = uniqueId("question", fieldIds);
    onChange({ fields: [...item.fields, { id, label: "New question", type: "text", optional: true }] });
  }

  return (
    <section className="space-y-6">
      <div className="card space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-navy">
            I want to make {item.article} <span className="text-teal">{item.label || "…"}</span>
          </h2>
          {canDelete && (
            <button type="button" className="btn-danger shrink-0" onClick={onDelete}>
              Delete item
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-[110px_1fr_220px]">
          <div>
            <label className="label" htmlFor="article">
              a / an
            </label>
            <select id="article" className="input" value={item.article} onChange={(e) => onChange({ article: e.target.value as "a" | "an" })}>
              <option value="a">a</option>
              <option value="an">an</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="label">
              Name (finishes the sentence)
            </label>
            <input id="label" className="input" value={item.label} onChange={(e) => onChange({ label: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="id">
              ID
            </label>
            <div className="flex gap-1">
              <input id="id" className="input font-mono text-xs" value={item.id} onChange={(e) => onChange({ id: e.target.value })} />
              <button type="button" className="btn px-2 text-xs" title="Make ID from name" onClick={() => onChange({ id: uniqueId(slugify(item.label), takenIds) })}>
                ↻
              </button>
            </div>
            {idTaken && <p className="mt-1 text-xs text-red-700">Another item uses this ID.</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="summary">
            Summary
          </label>
          <input id="summary" className="input" value={item.summary} onChange={(e) => onChange({ summary: e.target.value })} />
          <p className="help">Shown under the sentence once someone picks this item.</p>
        </div>
        <div>
          <label className="label" htmlFor="materialsHint">
            &quot;What do you already have?&quot; hint
          </label>
          <input id="materialsHint" className="input" value={item.materialsHint} onChange={(e) => onChange({ materialsHint: e.target.value })} />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-navy">Guided questions</h3>
            <p className="text-sm text-muted">
              Each answer fills its <code>{"{{id}}"}</code> placeholder in the prompt template.
            </p>
          </div>
          <button type="button" className="btn shrink-0" onClick={addField}>
            + Add question
          </button>
        </div>
        {item.fields.length === 0 && <p className="text-sm text-muted">No questions. The wizard will skip straight to the materials boxes.</p>}
        {item.fields.map((f, i) => (
          <FieldEditor
            key={i}
            field={f}
            first={i === 0}
            last={i === item.fields.length - 1}
            onChange={(field) => setField(i, field)}
            onMove={(dir) => onChange({ fields: move(item.fields, i, i + dir) })}
            onRemove={() => onChange({ fields: item.fields.filter((_, x) => x !== i) })}
          />
        ))}
      </div>

      <div className="card space-y-3">
        <h3 className="font-bold text-navy">Prompt template</h3>
        <p className="text-sm text-muted">
          The instructions sent to the AI. The person&apos;s files and pasted text are added above it automatically, and their
          extra instructions below it.
        </p>
        {fieldIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted">Placeholders:</span>
            {fieldIds.map((id) => (
              <code key={id} className={`rounded px-1.5 py-0.5 ${placeholders.includes(id) ? "bg-mint/30 text-navy" : "bg-amber-100 text-amber-900"}`}>
                {`{{${id}}}`}
              </code>
            ))}
          </div>
        )}
        <textarea
          aria-label="Prompt template"
          className="input min-h-96 font-mono text-xs leading-relaxed"
          value={item.template}
          onChange={(e) => onChange({ template: e.target.value })}
        />
        {unknown.length > 0 && (
          <p className="text-sm text-red-700">
            No question matches {unknown.map((u) => `{{${u}}}`).join(", ")}. These will show as &quot;Not specified&quot;.
          </p>
        )}
        {unused.length > 0 && (
          <p className="text-sm text-amber-800">
            Not used in the template: {unused.map((u) => `{{${u}}}`).join(", ")}. Those answers won&apos;t reach the AI.
          </p>
        )}
      </div>
    </section>
  );
}

function FieldEditor({
  field,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  field: GuidedField;
  first: boolean;
  last: boolean;
  onChange: (field: GuidedField) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  function setType(type: GuidedField["type"]) {
    const base = { id: field.id, label: field.label, help: field.help };
    if (type === "select") {
      onChange({ ...base, type, options: field.type === "select" ? field.options : ["Option 1", "Option 2"] });
    } else {
      onChange({ ...base, type, optional: field.type === "select" ? false : field.optional });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-canvas/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_170px_150px]">
        <div>
          <label className="label">Question</label>
          <input className="input" value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        </div>
        <div>
          <label className="label">Placeholder ID</label>
          <input
            className="input font-mono text-xs"
            value={field.id}
            onChange={(e) => onChange({ ...field, id: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() })}
          />
        </div>
        <div>
          <label className="label">Answer type</label>
          <select className="input" value={field.type} onChange={(e) => setType(e.target.value as GuidedField["type"])}>
            <option value="select">Choice list</option>
            <option value="text">Short text</option>
            <option value="textarea">Long text</option>
          </select>
        </div>
      </div>

      {field.type === "select" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
          <div>
            <label className="label">Choices (one per line)</label>
            <textarea
              className="input min-h-24"
              value={field.options.join("\n")}
              onChange={(e) => onChange({ ...field, options: e.target.value.split("\n") })}
            />
          </div>
          <div>
            <label className="label">Default choice</label>
            <select className="input" value={field.default ?? ""} onChange={(e) => onChange({ ...field, default: e.target.value })}>
              {field.options
                .filter((o) => o.trim())
                .map((o) => (
                  <option key={o}>{o}</option>
                ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label">Example text (shown greyed out)</label>
            <input className="input" value={field.placeholder ?? ""} onChange={(e) => onChange({ ...field, placeholder: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={Boolean(field.optional)} onChange={(e) => onChange({ ...field, optional: e.target.checked })} />
            Optional
          </label>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label">Help text (optional)</label>
          <input className="input" value={field.help ?? ""} onChange={(e) => onChange({ ...field, help: e.target.value })} />
        </div>
        <div className="flex items-end gap-1">
          <button type="button" className="btn px-2.5" aria-label="Move question up" disabled={first} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="btn px-2.5" aria-label="Move question down" disabled={last} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="btn-danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
