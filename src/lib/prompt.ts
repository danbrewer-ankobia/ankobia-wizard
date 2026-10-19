import type { PromptItem } from "@/prompts/types";

// Builds the user-facing task prompt. Used by the server to call the model and
// by the browser for the "See the prompt" preview, so both always match.

export type Answers = Record<string, string>;

export interface PromptInput {
  item: PromptItem;
  answers: Answers;
  materials: string;
  extraInstructions: string;
  /** Text pulled from uploaded files, keyed by file name. */
  fileTexts?: { name: string; text: string }[];
  /** Files sent natively to the model (PDFs/images) - listed by name only. */
  attachedFileNames?: string[];
}

export function fillTemplate(item: PromptItem, answers: Answers): string {
  return item.template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, id: string) => {
    const value = answers[id]?.trim();
    if (value) return value;
    const field = item.fields.find((f) => f.id === id);
    return field?.default?.trim() || "Not specified";
  });
}

export function buildPrompt(input: PromptInput): string {
  const parts: string[] = [];

  const files = input.fileTexts ?? [];
  const attached = input.attachedFileNames ?? [];
  const materials = input.materials.trim();
  if (materials || files.length || attached.length) {
    parts.push("<materials>");
    if (attached.length) parts.push(`Attached files: ${attached.join(", ")}`);
    for (const f of files) parts.push(`<file name="${f.name}">\n${f.text}\n</file>`);
    if (materials) parts.push(`<notes>\n${materials}\n</notes>`);
    parts.push("</materials>");
  } else {
    parts.push("<materials>\nNone provided. Work from the answers below and use placeholders for specifics.\n</materials>");
  }

  parts.push("", fillTemplate(input.item, input.answers));

  const extra = input.extraInstructions.trim();
  if (extra) {
    parts.push("", "<additional_instructions>", extra, "</additional_instructions>");
    parts.push("Follow the additional instructions above where they conflict with the defaults.");
  }

  return parts.join("\n");
}
