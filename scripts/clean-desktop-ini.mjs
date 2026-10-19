// OneDrive drops desktop.ini files into synced folders, which corrupts the
// Next.js/Turbopack build cache ("Failed to open database"). Remove them from
// .next and .git before building or starting the dev server.
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

async function sweep(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let removed = 0;
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) removed += await sweep(full);
    else if (e.name.toLowerCase() === "desktop.ini") {
      await rm(full, { force: true });
      removed++;
    }
  }
  return removed;
}

const removed = (await sweep(".next")) + (await sweep(".git"));
if (removed) console.log(`Removed ${removed} OneDrive desktop.ini file(s).`);
