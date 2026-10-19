import { isAdmin } from "@/lib/auth";
import { isLibraryCustomized, LibraryValidationError, loadLibrary, resetLibrary, saveLibrary } from "@/lib/library";

const unauthorized = () => Response.json({ error: "Please sign in." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ library: await loadLibrary(), customized: await isLibraryCustomized() });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  try {
    const library = await saveLibrary(await request.json());
    return Response.json({ library, customized: true });
  } catch (err) {
    if (err instanceof LibraryValidationError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// Reset to the built-in defaults.
export async function DELETE() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ library: await resetLibrary(), customized: false });
}
