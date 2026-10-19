import "server-only";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Minimal JSON file store for admin-managed data. DATA_DIR defaults to
// ./data (gitignored). Swap this module for a database or AWS Secrets
// Manager/SSM when hosting needs more than one server instance.

const DATA_DIR = process.env.DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data");

export async function readJson<T>(name: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ DATA_DIR, name), "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const file = path.join(/*turbopackIgnore: true*/ DATA_DIR, name);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(tmp, file);
}

export async function removeJson(name: string): Promise<void> {
  await rm(path.join(/*turbopackIgnore: true*/ DATA_DIR, name), { force: true });
}
