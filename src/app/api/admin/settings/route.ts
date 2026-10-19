import { isAdmin } from "@/lib/auth";
import { CLAUDE_MODELS } from "@/lib/models";
import { loadSettings, SettingsValidationError, toAdminView, updateSettings, type AdminSettingsUpdate } from "@/lib/settings";

const unauthorized = () => Response.json({ error: "Please sign in." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ settings: toAdminView(await loadSettings()), claudeModels: CLAUDE_MODELS });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  try {
    const update = (await request.json()) as AdminSettingsUpdate;
    const saved = await updateSettings(update);
    return Response.json({ settings: toAdminView(saved) });
  } catch (err) {
    if (err instanceof SettingsValidationError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message.includes("ADMIN_SECRET")) return Response.json({ error: err.message }, { status: 500 });
    throw err;
  }
}
