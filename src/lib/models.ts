// Model references are "<providerId>/<modelId>". Claude is always provider
// "anthropic"; admins can add any number of custom (in-house) providers.

export const ANTHROPIC_PROVIDER_ID = "anthropic";

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
}

// Claude models an admin can enable. Only current-generation models that
// support adaptive thinking are listed, so one request shape works for all.
export const CLAUDE_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Best balance of quality and cost. Recommended default.",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Faster and cheaper, strong for everyday documents.",
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Fastest and lowest cost. Best for short, simple items.",
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    description: "Most capable and most expensive. Slower on long jobs.",
  },
];

export const DEFAULT_MODEL_REF = `${ANTHROPIC_PROVIDER_ID}/claude-opus-5-5`;

export function makeModelRef(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

export function parseModelRef(ref: string): { providerId: string; modelId: string } | null {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) return null;
  return { providerId: ref.slice(0, slash), modelId: ref.slice(slash + 1) };
}

export function isClaudeModel(modelId: string): boolean {
  return CLAUDE_MODELS.some((m) => m.id === modelId);
}

// What the public (non-admin) side of the app sees: no keys, no URLs.
export interface PublicModelOption {
  ref: string;
  label: string;
  provider: string;
  description?: string;
  supportsFiles: boolean; // native PDF/image input
}

export interface PublicConfig {
  models: PublicModelOption[];
  defaultModel: string | null;
  configured: boolean;
}
