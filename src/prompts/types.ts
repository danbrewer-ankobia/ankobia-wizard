// A prompt library entry. Admins add and edit entries from /admin; the files in
// src/prompts/items/ are the built-in defaults.

export type GuidedField =
  | {
      id: string;
      label: string;
      help?: string;
      type: "select";
      options: string[];
      default?: string;
    }
  | {
      id: string;
      label: string;
      help?: string;
      type: "text" | "textarea";
      placeholder?: string;
      default?: string;
      optional?: boolean;
    };

export interface PromptItem {
  id: string;
  /** Text that completes "I want to make a ___". */
  label: string;
  /** "a" or "an" for the sentence. */
  article: "a" | "an";
  /** One line shown under the picker so beginners know what they'll get. */
  summary: string;
  /** Hint for the "what do you already have" box. */
  materialsHint: string;
  fields: GuidedField[];
  /**
   * The task prompt. {{fieldId}} placeholders are replaced with the user's
   * guided answers; unanswered optional fields become "Not specified".
   */
  template: string;
}

export interface PromptLibrary {
  systemPrompt: string;
  items: PromptItem[];
}
