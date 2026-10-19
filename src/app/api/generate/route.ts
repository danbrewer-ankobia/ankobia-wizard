import Anthropic from "@anthropic-ai/sdk";
import { FileError, prepareFiles } from "@/lib/files";
import { loadLibrary } from "@/lib/library";
import { generate, ProviderError } from "@/lib/providers";
import { loadSettings, publicConfig } from "@/lib/settings";

// Streams newline-delimited JSON events to the browser:
//   {"type":"status"|"text"|"notice"|"error"|"done", ...}

function friendlyError(err: unknown): string {
  if (err instanceof ProviderError || err instanceof FileError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The Claude API key was rejected. Ask an admin to check it in /admin.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy right now. Wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError) return `The request was rejected: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status ?? "network"}). Try again shortly.`;
  if (err instanceof Error && err.name === "AbortError") return "Stopped.";
  console.error("generate failed", err);
  return "Something went wrong. Try again, and tell an admin if it keeps happening.";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const [settings, library, config] = await Promise.all([loadSettings(), loadLibrary(), publicConfig()]);
  const item = library.items.find((i) => i.id === form.get("itemId"));
  if (!item) return Response.json({ error: "Pick what you want to make." }, { status: 400 });

  let answers: Record<string, string> = {};
  try {
    const raw = JSON.parse(String(form.get("answers") ?? "{}")) as Record<string, unknown>;
    answers = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? "").slice(0, 5000)]));
  } catch {
    return Response.json({ error: "Invalid answers." }, { status: 400 });
  }

  const modelRef = String(form.get("model") || config.defaultModel || "");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "status", message: files.length ? "Reading your files…" : "Getting started…" });
        const prepared = await prepareFiles(files);
        for await (const event of generate(settings, {
          modelRef,
          system: library.systemPrompt,
          prompt: {
            item,
            answers,
            materials: String(form.get("materials") ?? ""),
            extraInstructions: String(form.get("extra") ?? ""),
          },
          files: prepared,
          signal: request.signal,
        })) {
          send(event);
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
