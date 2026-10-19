"use client";

// Placeholder until the "AI models & keys" editor is built. The server-side
// pieces it needs already exist: GET/PUT /api/admin/settings and
// POST /api/admin/test. Until then, Claude uses the ANTHROPIC_API_KEY
// environment variable with every Claude model enabled and Opus 5.5 as default.
export function ModelsPanel() {
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-bold text-navy">AI models &amp; keys</h2>
      <p className="text-sm text-muted">
        This screen is coming soon. For now, Claude is configured with the <code>ANTHROPIC_API_KEY</code> server setting, every
        Claude model is available, and Claude Opus 5.5 is the default.
      </p>
    </section>
  );
}
