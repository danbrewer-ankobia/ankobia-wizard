import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  ANTHROPIC_PROVIDER_ID,
  CLAUDE_MODELS,
  DEFAULT_MODEL_REF,
  isClaudeModel,
  makeModelRef,
  parseModelRef,
  type PublicConfig,
  type PublicModelOption,
} from "./models";
import { readJson, writeJson } from "./store";

// Admin settings live in the data store (data/settings.json, gitignored).
// Secrets are AES-256-GCM encrypted with a key derived from ADMIN_SECRET, and
// are never returned to the browser - only a masked hint.

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string; // OpenAI-compatible root, e.g. https://ai.internal/v1
  apiKeyEnc?: string;
  apiKeyHint?: string;
  models: string[];
}

export interface Settings {
  anthropic: {
    apiKeyEnc?: string;
    apiKeyHint?: string;
    enabledModels: string[];
  };
  customProviders: CustomProvider[];
  defaultModel: string;
  updatedAt?: string;
}

// Shape exchanged with the admin page.
export interface AdminSettingsView {
  anthropic: { hasApiKey: boolean; apiKeyHint?: string; keySource: "settings" | "env" | "none"; enabledModels: string[] };
  customProviders: Array<Omit<CustomProvider, "apiKeyEnc"> & { hasApiKey: boolean }>;
  defaultModel: string;
  updatedAt?: string;
}

export interface AdminSettingsUpdate {
  anthropic: { apiKey?: string; clearApiKey?: boolean; enabledModels: string[] };
  customProviders: Array<{
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    clearApiKey?: boolean;
    models: string[];
  }>;
  defaultModel: string;
}

const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS: Settings = {
  anthropic: { enabledModels: CLAUDE_MODELS.map((m) => m.id) },
  customProviders: [],
  defaultModel: DEFAULT_MODEL_REF,
};

function secretKey(): Buffer {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SECRET must be set (16+ characters) to store API keys.");
  }
  return createHash("sha256").update(`ankobia-wizard:settings:${secret}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(enc: string): string {
  const [iv, tag, data] = enc.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function hint(key: string): string {
  return `••••${key.slice(-4)}`;
}

export async function loadSettings(): Promise<Settings> {
  const raw = await readJson<Partial<Settings>>(SETTINGS_FILE);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  return {
    anthropic: { ...DEFAULT_SETTINGS.anthropic, ...raw.anthropic },
    customProviders: raw.customProviders ?? [],
    defaultModel: raw.defaultModel ?? DEFAULT_SETTINGS.defaultModel,
    updatedAt: raw.updatedAt,
  };
}

export function anthropicApiKey(settings: Settings): string | undefined {
  if (settings.anthropic.apiKeyEnc) return decrypt(settings.anthropic.apiKeyEnc);
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export function customProviderApiKey(provider: CustomProvider): string | undefined {
  return provider.apiKeyEnc ? decrypt(provider.apiKeyEnc) : undefined;
}

// Every model a user may pick, in display order.
export function enabledModels(settings: Settings): PublicModelOption[] {
  const options: PublicModelOption[] = [];
  if (anthropicApiKey(settings)) {
    for (const m of CLAUDE_MODELS) {
      if (settings.anthropic.enabledModels.includes(m.id)) {
        options.push({
          ref: makeModelRef(ANTHROPIC_PROVIDER_ID, m.id),
          label: m.label,
          provider: "Claude",
          description: m.description,
          supportsFiles: true,
        });
      }
    }
  }
  for (const p of settings.customProviders) {
    for (const model of p.models) {
      options.push({ ref: makeModelRef(p.id, model), label: model, provider: p.name, supportsFiles: false });
    }
  }
  return options;
}

export async function publicConfig(): Promise<PublicConfig> {
  const settings = await loadSettings();
  const models = enabledModels(settings);
  const defaultModel = models.find((m) => m.ref === settings.defaultModel)?.ref ?? models[0]?.ref ?? null;
  return { models, defaultModel, configured: models.length > 0 };
}

export function toAdminView(settings: Settings): AdminSettingsView {
  return {
    anthropic: {
      hasApiKey: Boolean(settings.anthropic.apiKeyEnc || process.env.ANTHROPIC_API_KEY),
      apiKeyHint: settings.anthropic.apiKeyHint,
      keySource: settings.anthropic.apiKeyEnc ? "settings" : process.env.ANTHROPIC_API_KEY ? "env" : "none",
      enabledModels: settings.anthropic.enabledModels,
    },
    customProviders: settings.customProviders.map(({ apiKeyEnc, ...rest }) => ({ ...rest, hasApiKey: Boolean(apiKeyEnc) })),
    defaultModel: settings.defaultModel,
    updatedAt: settings.updatedAt,
  };
}

const PROVIDER_ID_RE = /^[a-z0-9-]+$/;

export class SettingsValidationError extends Error {}

export async function updateSettings(update: AdminSettingsUpdate): Promise<Settings> {
  const current = await loadSettings();

  const enabledClaude = update.anthropic.enabledModels.filter(isClaudeModel);
  const anthropic: Settings["anthropic"] = { enabledModels: enabledClaude };
  const newKey = update.anthropic.apiKey?.trim();
  if (newKey) {
    anthropic.apiKeyEnc = encrypt(newKey);
    anthropic.apiKeyHint = hint(newKey);
  } else if (!update.anthropic.clearApiKey) {
    anthropic.apiKeyEnc = current.anthropic.apiKeyEnc;
    anthropic.apiKeyHint = current.anthropic.apiKeyHint;
  }

  const customProviders: CustomProvider[] = update.customProviders.map((p) => {
    const name = p.name.trim();
    const baseUrl = p.baseUrl.trim().replace(/\/+$/, "");
    if (!name) throw new SettingsValidationError("Each custom provider needs a name.");
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new SettingsValidationError(`"${name}" needs a valid base URL.`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new SettingsValidationError(`"${name}" base URL must be http or https.`);
    }
    const models = [...new Set(p.models.map((m) => m.trim()).filter(Boolean))];
    if (models.length === 0) throw new SettingsValidationError(`"${name}" needs at least one model name.`);

    const existing = p.id ? current.customProviders.find((c) => c.id === p.id) : undefined;
    const id = existing?.id ?? `custom-${randomUUID().slice(0, 8)}`;
    if (id === ANTHROPIC_PROVIDER_ID || !PROVIDER_ID_RE.test(id)) throw new SettingsValidationError("Invalid provider id.");

    const provider: CustomProvider = { id, name, baseUrl, models };
    const key = p.apiKey?.trim();
    if (key) {
      provider.apiKeyEnc = encrypt(key);
      provider.apiKeyHint = hint(key);
    } else if (existing && !p.clearApiKey) {
      provider.apiKeyEnc = existing.apiKeyEnc;
      provider.apiKeyHint = existing.apiKeyHint;
    }
    return provider;
  });

  const next: Settings = {
    anthropic,
    customProviders,
    defaultModel: update.defaultModel,
    updatedAt: new Date().toISOString(),
  };

  const allowed = enabledModels(next).map((m) => m.ref);
  if (allowed.length > 0 && !allowed.includes(next.defaultModel)) {
    throw new SettingsValidationError("The default model must be one of the enabled models.");
  }
  if (!parseModelRef(next.defaultModel) && allowed.length > 0) {
    throw new SettingsValidationError("Invalid default model.");
  }

  await writeJson(SETTINGS_FILE, next);
  return next;
}
