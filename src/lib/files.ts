import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText } from "unpdf";

// Turns uploaded files into model input. PDFs and images can go to Claude
// natively (it reads layout, tables and pictures); everything else - and
// everything for in-house models - becomes extracted text.

export const MAX_FILES = 10;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md", ".csv", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export type PreparedFile =
  | { kind: "text"; name: string; text: string }
  | { kind: "pdf"; name: string; base64: string; text: () => Promise<string> }
  | { kind: "image"; name: string; mediaType: (typeof IMAGE_TYPES)[string]; base64: string };

export class FileError extends Error {}

function ext(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

async function pptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .map((path) => ({ path, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(path)?.[1]) }))
    .filter((s) => Number.isFinite(s.n))
    .sort((a, b) => a.n - b.n);
  const out: string[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.path)!.async("string");
    const paragraphs = xml.split(/<\/a:p>/).map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""),
    );
    out.push(`--- Slide ${s.n} ---\n${paragraphs.filter((p) => p.trim()).join("\n")}`);
  }
  return out.join("\n\n");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function pdfText(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text;
}

export async function prepareFiles(files: File[]): Promise<PreparedFile[]> {
  if (files.length > MAX_FILES) throw new FileError(`Please attach ${MAX_FILES} files or fewer.`);
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new FileError("Attachments are over the 25 MB total limit.");

  const prepared: PreparedFile[] = [];
  for (const file of files) {
    const e = ext(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      if (e === ".pdf") {
        prepared.push({ kind: "pdf", name: file.name, base64: buffer.toString("base64"), text: () => pdfText(buffer) });
      } else if (IMAGE_TYPES[e]) {
        prepared.push({ kind: "image", name: file.name, mediaType: IMAGE_TYPES[e], base64: buffer.toString("base64") });
      } else if (e === ".docx") {
        prepared.push({ kind: "text", name: file.name, text: (await mammoth.extractRawText({ buffer })).value });
      } else if (e === ".pptx") {
        prepared.push({ kind: "text", name: file.name, text: await pptxText(buffer) });
      } else if ([".txt", ".md", ".csv", ".json"].includes(e)) {
        prepared.push({ kind: "text", name: file.name, text: buffer.toString("utf8") });
      } else {
        throw new FileError(`"${file.name}" isn't a supported file type.`);
      }
    } catch (err) {
      if (err instanceof FileError) throw err;
      throw new FileError(`Couldn't read "${file.name}". Is it a valid, unprotected file?`);
    }
  }
  return prepared;
}
