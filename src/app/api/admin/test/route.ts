import Anthropic from "@anthropic-ai/sdk";
import { isAdmin } from "@/lib/auth";
import { testClaudeKey, testCustomProvider } from "@/lib/providers";
import { anthropicApiKey, loadSettings } from "@/lib/settings";

// Checks a saved provider connection. Body: {"provider":"anthropic"} or {"provider":"<custom id>"}.
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { provider } = (await request.json().catch(() => ({}))) as { provider?: string };
  const settings = await loadSettings();

  try {
    if (provider === "anthropic") {
      const key = anthropicApiKey(settings);
      if (!key) return Response.json({ ok: false, message: "No Claude API key saved yet." });
      await testClaudeKey(key);
      return Response.json({ ok: true, message: "Connected to Claude." });
    }
    const custom = settings.customProviders.find((p) => p.id === provider);
    if (!custom) return Response.json({ ok: false, message: "Save this provider before testing it." });
    const models = await testCustomProvider(custom);
    const missing = custom.models.filter((m) => models.length > 0 && !models.includes(m));
    return Response.json({
      ok: true,
      message: models.length
        ? `Connected. Server lists ${models.length} model(s)${missing.length ? `; not found: ${missing.join(", ")}` : ""}.`
        : "Connected.",
    });
  } catch (err) {
    const message =
      err instanceof Anthropic.AuthenticationError
        ? "Claude rejected the API key."
        : err instanceof Error
          ? `Connection failed: ${err.message}`
          : "Connection failed.";
    return Response.json({ ok: false, message });
  }
}
