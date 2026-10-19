import { adminConfigured, checkPassword, endAdminSession, isAdmin, startAdminSession } from "@/lib/auth";

export async function GET() {
  return Response.json({ configured: adminConfigured(), authenticated: await isAdmin() });
}

// Log in.
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "Admin access isn't set up. Set ADMIN_PASSWORD and ADMIN_SECRET on the server." }, { status: 503 });
  }
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 750)); // slow down guessing
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  await startAdminSession();
  return Response.json({ authenticated: true });
}

// Log out.
export async function DELETE() {
  await endAdminSession();
  return Response.json({ authenticated: false });
}
