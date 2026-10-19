import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { PreparedFile } from "./files";
import { ANTHROPIC_PROVIDER_ID, parseModelRef } from "./models";
import { buildPrompt, type PromptInput } from "./prompt";
import { anthropicApiKey, customProviderApiKey, enabledModels, type CustomProvider, type Settings } from "./settings";

// One interface over every AI backend. Claude goes through the Anthropic SDK;
// in-house models go through any OpenAI-compatible /chat/completions endpoint
// (vLLM, Ollama, LiteLLM, Azure-style gateways, ...).

export type GenerateEvent =
  | { type: "status"; message: string }
  | { type: "text"; text: string }
  | { type: "notice"; message: string };

export interface GenerateRequest {
  modelRef: string;
  system: string;
  prompt: Omit<PromptInput, "fileTexts" | "attachedFileNames">;
  files: PreparedFile[];
  signal?: AbortSignal;
}

export class ProviderError extends Error {}

export async function* generate(settings: Settings, req: GenerateRequest): AsyncGenerator<GenerateEvent> {
  const allowed = enabledModels(settings).map((m) => m.ref);
  if (allowed.length === 0) {
    throw new ProviderError("No AI model is set up yet. Ask an admin to add an API key.");
  }
  const parsed = parseModelRef(req.modelRef);
  if (!parsed || !allowed.includes(req.modelRef)) {
    throw new ProviderError("That model isn't enabled. Ask an admin to enable it in /admin.");
  }

  if (parsed.providerId === ANTHROPIC_PROVIDER_ID) {
    yield* generateClaude(anthropicApiKey(settings)!, parsed.modelId, settings.anthropic.effort, req);
    return;
  }
  const provider = settings.customProviders.find((p) => p.id === parsed.providerId);
  if (!provider) throw new ProviderError("That AI provider no longer exists.");
  yield* generateOpenAICompatible(provider, parsed.modelId, req);
}

// ---------------------------------------------------------------- Claude

async function* generateClaude(
  apiKey: string,
  model: string,
  effort: Settings["anthropic"]["effort"],
  req: GenerateRequest,
): AsyncGenerator<GenerateEvent> {
  const client = new Anthropic({ apiKey });

  const fileBlocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  const fileTexts: { name: string; text: string }[] = [];
  const attached: string[] = [];
  for (const f of req.files) {
    if (f.kind === "pdf") {
      fileBlocks.push({
        type: "document",
        title: f.name,
        source: { type: "base64", media_type: "application/pdf", data: f.base64 },
      });
      attached.push(f.name);
    } else if (f.kind === "image") {
      fileBlocks.push({ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } });
      attached.push(f.name);
    } else {
      fileTexts.push({ name: f.name, text: f.text });
    }
  }

  const text = buildPrompt({ ...req.prompt, fileTexts, attachedFileNames: attached });

  yield { type: "status", message: "Thinking it through…" };

  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: 64000,
      // Server-side fallback: if the model declines for policy reasons, the API
      // retries on its default fallback model inside the same request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: req.system,
      messages: [{ role: "user", content: [...fileBlocks, { type: "text", text }] }],
    },
    { signal: req.signal },
  );

  let started = false;
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      if (!started) {
        started = true;
        yield { type: "status", message: "Writing…" };
      }
      yield { type: "text", text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield { type: "notice", message: "The AI declined to complete this request. Try rewording it or removing sensitive material." };
  } else if (final.stop_reason === "max_tokens") {
    yield { type: "notice", message: "The response hit the length limit and may be cut off. Try asking for a shorter version." };
  }
}

// ---------------------------------------------------- OpenAI-compatible

async function* generateOpenAICompatible(
  provider: CustomProvider,
  model: string,
  req: GenerateRequest,
): AsyncGenerator<GenerateEvent> {
  const fileTexts: { name: string; text: string }[] = [];
  for (const f of req.files) {
    if (f.kind === "image") {
      throw new ProviderError(`${provider.name} can't read images. Remove "${f.name}" or pick a Claude model.`);
    }
    fileTexts.push({ name: f.name, text: f.kind === "pdf" ? await f.text() : f.text });
  }
  const text = buildPrompt({ ...req.prompt, fileTexts });

  yield { type: "status", message: `Sending to ${provider.name}…` };

  const apiKey = customProviderApiKey(provider);
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: text },
      ],
    }),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    throw new ProviderError(`${provider.name} returned an error (${res.status}). Check the provider settings in /admin.`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let started = false;
  let finishReason: string | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let chunk: { choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = chunk.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (delta) {
        if (!started) {
          started = true;
          yield { type: "status", message: "Writing…" };
        }
        yield { type: "text", text: delta };
      }
    }
  }
  if (finishReason === "length") {
    yield { type: "notice", message: "The response hit the length limit and may be cut off." };
  }
}

// ------------------------------------------------------- admin key tests

export async function testClaudeKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 });
  await client.models.retrieve("claude-opus-5-5");
}

export async function testCustomProvider(provider: CustomProvider): Promise<string[]> {
  const apiKey = customProviderApiKey(provider);
  const res = await fetch(`${provider.baseUrl}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return body.data?.map((m) => m.id) ?? [];
}
