import type { PromptItem } from "../types";

export const stepByStep: PromptItem = {
  id: "step-by-step",
  label: "set of step-by-step instructions",
  article: "a",
  summary: "Clear, numbered instructions someone can follow without help.",
  materialsHint: "Existing procedures, screenshots described in text, notes, or a rough list of steps.",
  fields: [
    {
      id: "task",
      label: "What task are the instructions for?",
      type: "text",
      placeholder: "e.g. Submitting a bond in eBonds",
    },
    {
      id: "skill",
      label: "How experienced is the reader?",
      type: "select",
      options: ["Complete beginner", "Some experience", "Experienced / just needs a reference"],
      default: "Complete beginner",
    },
    {
      id: "format",
      label: "Where will it be used?",
      type: "select",
      options: ["Printed or PDF job aid", "Internal wiki / knowledge base", "Email to a customer", "Training handout"],
      default: "Internal wiki / knowledge base",
    },
    {
      id: "prereqs",
      label: "Anything the reader needs first?",
      type: "textarea",
      placeholder: "e.g. An account, admin access, a specific browser",
      optional: true,
    },
  ],
  template: `Write step-by-step instructions.

Task: {{task}}
Reader experience: {{skill}}
Where it will be used: {{format}}
Known prerequisites: {{prereqs}}

Guidelines:
1. Start with a one-line goal ("By the end, you will have …") and an estimated time to complete.
2. List prerequisites (access, tools, information to have ready) before the steps.
3. Number every step. Each step is one action, starts with a verb, and names the exact button, field, or menu in **bold**.
4. After any step where the reader could get lost, add what they should see next ("You should now see …").
5. Put warnings and tips right where they apply, marked "⚠️ Caution:" or "💡 Tip:".
6. Group long procedures into phases with ## headings.
7. End with "Troubleshooting" (common problems and fixes) and "Need help?" (who to contact; use a placeholder if unknown).
8. Only describe steps supported by the materials or common knowledge of the tool; mark uncertain details with [VERIFY: …].

Output format: Markdown, ready to paste into the destination above.`,
};
