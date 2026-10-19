import "server-only";
import { DEFAULT_LIBRARY } from "@/prompts";
import type { GuidedField, PromptItem, PromptLibrary } from "@/prompts/types";
import { readJson, removeJson, writeJson } from "./store";

// The prompt library admins edit from /admin. Until an admin saves changes,
// the built-in defaults in src/prompts/ are served.

const LIBRARY_FILE = "prompt-library.json";

export interface StoredLibrary extends PromptLibrary {
  updatedAt?: string;
}

export async function loadLibrary(): Promise<StoredLibrary> {
  return (await readJson<StoredLibrary>(LIBRARY_FILE)) ?? structuredClone(DEFAULT_LIBRARY);
}

export async function isLibraryCustomized(): Promise<boolean> {
  return (await readJson(LIBRARY_FILE)) !== undefined;
}

export async function resetLibrary(): Promise<StoredLibrary> {
  await removeJson(LIBRARY_FILE);
  return structuredClone(DEFAULT_LIBRARY);
}

export class LibraryValidationError extends Error {}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const MAX_TEXT = 20_000;

function str(value: unknown, what: string, { optional = false, max = 500 } = {}): string {
  if (value === undefined || value === null || value === "") {
    if (optional) return "";
    throw new LibraryValidationError(`${what} is required.`);
  }
  if (typeof value !== "string") throw new LibraryValidationError(`${what} must be text.`);
  const trimmed = value.trim();
  if (!trimmed && !optional) throw new LibraryValidationError(`${what} is required.`);
  if (trimmed.length > max) throw new LibraryValidationError(`${what} is too long (max ${max} characters).`);
  return trimmed;
}

function validateField(raw: unknown, itemLabel: string): GuidedField {
  const f = raw as Record<string, unknown>;
  const id = str(f.id, `A question id in "${itemLabel}"`, { max: 48 });
  if (!ID_RE.test(id)) {
    throw new LibraryValidationError(`Question id "${id}" in "${itemLabel}" may only use lowercase letters, numbers and dashes.`);
  }
  const label = str(f.label, `Question "${id}" label`);
  const help = str(f.help, `Question "${id}" help`, { optional: true }) || undefined;
  if (f.type === "select") {
    const options = Array.isArray(f.options)
      ? [...new Set(f.options.map((o) => String(o).trim()).filter(Boolean))]
      : [];
    if (options.length < 2) throw new LibraryValidationError(`Question "${label}" needs at least two choices.`);
    const def = str(f.default, "Default", { optional: true });
    return { id, label, help, type: "select", options, default: options.includes(def) ? def : options[0] };
  }
  if (f.type === "text" || f.type === "textarea") {
    return {
      id,
      label,
      help,
      type: f.type,
      placeholder: str(f.placeholder, `Question "${label}" placeholder`, { optional: true }) || undefined,
      default: str(f.default, `Question "${label}" default`, { optional: true, max: 2000 }) || undefined,
      optional: Boolean(f.optional),
    };
  }
  throw new LibraryValidationError(`Question "${label}" has an unknown type.`);
}

function validateItem(raw: unknown): PromptItem {
  const i = raw as Record<string, unknown>;
  const label = str(i.label, "Item name", { max: 80 });
  const id = str(i.id, `"${label}" id`, { max: 48 });
  if (!ID_RE.test(id)) throw new LibraryValidationError(`"${label}" id may only use lowercase letters, numbers and dashes.`);
  const fields = Array.isArray(i.fields) ? i.fields.map((f) => validateField(f, label)) : [];
  const fieldIds = fields.map((f) => f.id);
  if (new Set(fieldIds).size !== fieldIds.length) throw new LibraryValidationError(`"${label}" has two questions with the same id.`);
  return {
    id,
    label,
    article: i.article === "an" ? "an" : "a",
    summary: str(i.summary, `"${label}" summary`),
    materialsHint: str(i.materialsHint, `"${label}" materials hint`, { optional: true }),
    fields,
    template: str(i.template, `"${label}" prompt template`, { max: MAX_TEXT }),
  };
}

export async function saveLibrary(raw: unknown): Promise<StoredLibrary> {
  const lib = raw as Record<string, unknown>;
  const items = Array.isArray(lib.items) ? lib.items.map(validateItem) : [];
  if (items.length === 0) throw new LibraryValidationError("The library needs at least one item.");
  const ids = items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) throw new LibraryValidationError("Two items have the same id.");
  const stored: StoredLibrary = {
    systemPrompt: str(lib.systemPrompt, "System prompt", { max: MAX_TEXT }),
    items,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(LIBRARY_FILE, stored);
  return stored;
}
