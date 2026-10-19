"use client";

import { buildPrompt, type Answers } from "@/lib/prompt";
import type { PublicConfig } from "@/lib/models";
import type { PromptItem, PromptLibrary } from "@/prompts/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { Sparkles } from "./Sparkles";

type Config = PublicConfig & { library: PromptLibrary };

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp";
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

function defaultAnswers(item: PromptItem | undefined): Answers {
  if (!item) return {};
  return Object.fromEntries(item.fields.map((f) => [f.id, f.default ?? ""]));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Wizard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState("");

  const [itemId, setItemId] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [materials, setMaterials] = useState("");
  const [extra, setExtra] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [model, setModel] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((c: Config) => {
        setConfig(c);
        setModel(c.defaultModel ?? "");
      })
      .catch(() => setLoadError("Couldn't load the wizard. Refresh the page to try again."));
  }, []);

  const item = config?.library.items.find((i) => i.id === itemId);
  const selectedModel = config?.models.find((m) => m.ref === model);

  function chooseItem(id: string) {
    setItemId(id);
    setAnswers(defaultAnswers(config?.library.items.find((i) => i.id === id)));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError("");
    const next = [...files];
    for (const f of Array.from(list)) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPT.split(",").includes(ext)) {
        setFileError(`"${f.name}" isn't supported. Use PDF, Word, PowerPoint, text, or image files.`);
        continue;
      }
      if (!next.some((n) => n.name === f.name && n.size === f.size)) next.push(f);
    }
    if (next.length > MAX_FILES) {
      setFileError(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) {
      setFileError("Files add up to more than 25 MB. Remove some and try again.");
      return;
    }
    setFiles(next);
  }

  const promptPreview = useMemo(() => {
    if (!item) return "";
    return buildPrompt({
      item,
      answers,
      materials,
      extraInstructions: extra,
      attachedFileNames: files.map((f) => f.name),
    });
  }, [item, answers, materials, extra, files]);

  const missingRequired = item?.fields.filter((f) => f.type !== "select" && !f.optional && !answers[f.id]?.trim()) ?? [];
  const hasImages = files.some((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name));
  const imageWarning = hasImages && selectedModel && !selectedModel.supportsFiles;
  const canGenerate = Boolean(item && model && !running && missingRequired.length === 0 && !imageWarning);

  async function generate() {
    if (!item) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setOutput("");
    setError("");
    setNotice("");
    setStatus("Getting started…");
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const form = new FormData();
    form.set("itemId", item.id);
    form.set("answers", JSON.stringify(answers));
    form.set("materials", materials);
    form.set("extra", extra);
    form.set("model", model);
    for (const f of files) form.append("files", f);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status}).`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; text?: string; message?: string };
          if (event.type === "text") setOutput((o) => o + event.text);
          else if (event.type === "status") setStatus(event.message ?? "");
          else if (event.type === "notice") setNotice(event.message ?? "");
          else if (event.type === "error") setError(event.message ?? "Something went wrong.");
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setRunning(false);
      setStatus("");
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item?.id ?? "ankobia-wizard"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startOver() {
    stop();
    setItemId("");
    setAnswers({});
    setMaterials("");
    setExtra("");
    setFiles([]);
    setOutput("");
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loadError) return <p className="mx-auto max-w-4xl px-4 py-16 text-center text-red-700">{loadError}</p>;
  if (!config) return <p className="mx-auto max-w-4xl px-4 py-16 text-center text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {!config.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No AI model is set up yet. An admin needs to add an API key in <a className="font-semibold underline" href="/admin">Admin</a>.
        </div>
      )}

      {/* Step 1: the sentence */}
      <section className="relative isolate rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(131,219,194,0.28),transparent_70%)] px-2 py-8 text-center sm:px-10">
        <Sparkles />
        <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-3xl font-bold text-navy sm:text-4xl">
          <span>I want to make {item ? item.article : "a"}</span>
          <label className="sr-only" htmlFor="item">
            What do you want to make?
          </label>
          <select
            id="item"
            value={itemId}
            onChange={(e) => chooseItem(e.target.value)}
            className="cursor-pointer rounded-xl border-2 border-dashed border-teal bg-white px-3 py-1 text-teal outline-none focus:border-solid focus:ring-4 focus:ring-mint/50"
          >
            <option value="" disabled>
              ________
            </option>
            {config.library.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          {item ? item.summary : "Pick what you want to create. We'll ask a few quick questions and write a great prompt for you."}
        </p>
        {!item && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {config.library.items.map((i) => (
              <button key={i.id} type="button" onClick={() => chooseItem(i.id)} className="btn rounded-full">
                {i.label.charAt(0).toUpperCase() + i.label.slice(1)}
              </button>
            ))}
          </div>
        )}
      </section>

      {item && (
        <>
          {/* Step 2: guided questions */}
          {item.fields.length > 0 && (
            <section className="card">
              <h2 className="mb-1 text-lg font-bold text-navy">A few quick questions</h2>
              <p className="mb-5 text-sm text-muted">These shape the result. Defaults are fine if you&apos;re not sure.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                {item.fields.map((f) => (
                  <div key={f.id} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="label" htmlFor={`f-${f.id}`}>
                      {f.label}
                      {f.type !== "select" && f.optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
                    </label>
                    {f.type === "select" ? (
                      <select
                        id={`f-${f.id}`}
                        className="input"
                        value={answers[f.id] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                      >
                        {f.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        id={`f-${f.id}`}
                        className="input min-h-20"
                        placeholder={f.placeholder}
                        value={answers[f.id] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                      />
                    ) : (
                      <input
                        id={`f-${f.id}`}
                        className="input"
                        placeholder={f.placeholder}
                        value={answers[f.id] ?? ""}
                        onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}
                      />
                    )}
                    {f.help && <p className="help">{f.help}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Step 3: the two boxes */}
          <section className="grid gap-6 md:grid-cols-2">
            <div className="card flex flex-col">
              <h2 className="text-lg font-bold text-navy">What do you already have?</h2>
              <p className="mb-4 text-sm text-muted">{item.materialsHint || "Drop in files or paste anything useful."}</p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                className={`mb-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
                  dragging ? "border-teal bg-mint/20" : "border-line hover:border-sea hover:bg-canvas"
                }`}
              >
                <p className="font-semibold text-navy">Drop files here or click to browse</p>
                <p className="mt-1 text-xs text-muted">PDF, Word, PowerPoint, text, or images · up to 25 MB total</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {fileError && <p className="mb-2 text-sm text-red-700">{fileError}</p>}
              {files.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {files.map((f) => (
                    <li key={f.name + f.size} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-1.5 text-sm">
                      <span className="truncate">
                        {f.name} <span className="text-muted">· {formatBytes(f.size)}</span>
                      </span>
                      <button
                        type="button"
                        className="ml-2 text-muted hover:text-red-700"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles(files.filter((x) => x !== f))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="label" htmlFor="materials">
                Or paste text
              </label>
              <textarea
                id="materials"
                className="input min-h-40 flex-1"
                placeholder="Paste notes, an email thread, bullet points, data…"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            </div>

            <div className="card flex flex-col">
              <h2 className="text-lg font-bold text-navy">Anything else the AI should know?</h2>
              <p className="mb-4 text-sm text-muted">
                Extra instructions, things to avoid, a style to copy. Totally optional.
              </p>
              <textarea
                id="extra"
                aria-label="Additional instructions"
                className="input min-h-40 flex-1"
                placeholder={'e.g. "Keep it under 2 pages", "Mention our 24/7 support", "Don\'t use technical jargon"'}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </div>
          </section>

          {/* Step 4: generate */}
          <section className="card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {config.models.length > 1 && (
                  <div className="sm:w-72">
                    <label className="label" htmlFor="model">
                      AI model
                    </label>
                    <select id="model" className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                      {config.models.map((m) => (
                        <option key={m.ref} value={m.ref}>
                          {m.label}
                          {m.provider !== "Claude" ? ` (${m.provider})` : ""}
                          {m.ref === config.defaultModel ? " - default" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button type="button" className="btn" onClick={() => setShowPrompt(!showPrompt)} aria-expanded={showPrompt}>
                  {showPrompt ? "Hide the prompt" : "See the prompt"}
                </button>
              </div>
              {running ? (
                <button type="button" className="btn-danger" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button type="button" className="btn-primary px-8 py-3 text-base" disabled={!canGenerate} onClick={generate}>
                  ✨ Make my {item.label}
                </button>
              )}
            </div>
            {missingRequired.length > 0 && (
              <p className="mt-3 text-sm text-muted">Answer &quot;{missingRequired[0].label}&quot; to continue.</p>
            )}
            {imageWarning && (
              <p className="mt-3 text-sm text-red-700">{selectedModel?.provider} can&apos;t read images. Remove them or pick a Claude model.</p>
            )}
            {showPrompt && (
              <div className="mt-5">
                <p className="mb-2 text-sm text-muted">
                  This is exactly what the wizard sends to the AI, along with a standing set of house rules. Learning from it is a
                  great way to get better at prompting.
                </p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
                  {promptPreview}
                </pre>
              </div>
            )}
          </section>

          {/* Output */}
          <div ref={outputRef} className="scroll-mt-6">
            {(running || output || error) && (
              <section className="card">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <h2 className="text-lg font-bold text-navy">Your {item.label}</h2>
                  {output && !running && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn" onClick={copy}>
                        {copied ? "Copied!" : "Copy"}
                      </button>
                      <button type="button" className="btn" onClick={download}>
                        Download (.md)
                      </button>
                      <button type="button" className="btn" onClick={generate}>
                        Try again
                      </button>
                      <button type="button" className="btn" onClick={startOver}>
                        Start over
                      </button>
                    </div>
                  )}
                </div>
                {running && status && (
                  <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-teal" />
                    {status}
                  </p>
                )}
                {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
                {notice && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}
                {output && <Markdown>{output}</Markdown>}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
