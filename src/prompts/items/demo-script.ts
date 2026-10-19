import type { PromptItem } from "../types";

export const demoScript: PromptItem = {
  id: "demo-script",
  label: "demo script",
  article: "a",
  summary: "A timed walkthrough script with what to say and what to click.",
  materialsHint: "Product notes, feature lists, customer background, or a previous demo outline.",
  fields: [
    {
      id: "product",
      label: "What are you demoing?",
      type: "text",
      placeholder: "e.g. Kobi 2.0 clerk workflow",
    },
    {
      id: "audience",
      label: "Who is watching?",
      type: "text",
      placeholder: "e.g. County clerk's office staff and IT lead",
    },
    {
      id: "duration",
      label: "How long is the demo?",
      type: "select",
      options: ["5 minutes", "15 minutes", "30 minutes", "45-60 minutes"],
      default: "15 minutes",
    },
    {
      id: "pain-points",
      label: "What problems does this audience care about most?",
      type: "textarea",
      placeholder: "e.g. Manual data entry, slow approvals, audit trail",
      optional: true,
    },
  ],
  template: `Write a product demo script.

Product / feature being demoed: {{product}}
Audience: {{audience}}
Total time: {{duration}}
Audience pain points: {{pain-points}}

Guidelines:
1. Structure it as: opening hook (tie to their pain points) → agenda → 2-4 demo segments → recap of value → clear next step / call to action → time for Q&A.
2. Give each segment a time allocation so the total fits {{duration}}.
3. For each segment, use a two-column style: **Do** (exactly what the presenter clicks or shows) and **Say** (natural, spoken-language talking points). Keep "Say" conversational, not scripted-sounding.
4. Tell a story with a realistic scenario or persona rather than touring features. Connect every feature shown to a benefit for this audience.
5. Include "If something goes wrong" backup lines and 3-5 likely audience questions with suggested answers.
6. Only claim capabilities supported by the materials; mark anything uncertain with [VERIFY: …].

Output format (Markdown):
# <Demo title>
**Goal:** … **Total time:** …
Then a table or ### heading per segment with time, **Do**, and **Say**, followed by "Likely questions" and "Backup plan".`,
};
