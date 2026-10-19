import { loadLibrary } from "@/lib/library";
import { publicConfig } from "@/lib/settings";
import { connection } from "next/server";

// Public config for the wizard page: enabled models and the prompt library.
// Never includes keys or provider URLs.
export async function GET() {
  await connection();
  const [config, library] = await Promise.all([publicConfig(), loadLibrary()]);
  return Response.json({ ...config, library: { systemPrompt: library.systemPrompt, items: library.items } });
}
