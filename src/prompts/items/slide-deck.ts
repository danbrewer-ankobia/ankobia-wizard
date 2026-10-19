import type { PromptItem } from "../types";

export const slideDeck: PromptItem = {
  id: "slide-deck",
  label: "slide deck",
  article: "a",
  summary: "A slide-by-slide deck with titles, key points, visual ideas, and speaker notes.",
  materialsHint: "Notes, an existing deck, a report, meeting notes, data, or a rough outline.",
  fields: [
    {
      id: "audience",
      label: "Who is the audience?",
      type: "select",
      options: ["Executives / leadership", "Customers or prospects", "Internal team", "Technical audience", "General / mixed audience"],
      default: "Executives / leadership",
    },
    {
      id: "goal",
      label: "What should the audience do or decide after seeing it?",
      type: "text",
      placeholder: "e.g. Approve the Phase 2 budget",
    },
    {
      id: "slide-count",
      label: "About how many slides?",
      type: "select",
      options: ["5 or fewer", "6-10", "11-15", "16-20"],
      default: "6-10",
    },
    {
      id: "tone",
      label: "Tone",
      type: "select",
      options: ["Confident and persuasive", "Neutral and informative", "Friendly and conversational", "Formal"],
      default: "Confident and persuasive",
    },
    {
      id: "must-include",
      label: "Any slides or points that must be included?",
      type: "textarea",
      placeholder: "e.g. A timeline slide, pricing, a customer quote",
      optional: true,
    },
  ],
  template: `Create a presentation slide deck.

Audience: {{audience}}
Desired outcome (what the audience should do or decide): {{goal}}
Target length: {{slide-count}} slides
Tone: {{tone}}
Must include: {{must-include}}

How to build it:
1. Start with the one-sentence core message of the deck, then design every slide to support it.
2. Follow a clear story arc: context or problem → insight or solution → evidence → what happens next / the ask.
3. Write slide titles as short takeaway statements ("Phase 1 cut processing time by 40%"), not topic labels ("Results").
4. Keep each slide to 3-5 concise bullets. No paragraphs on slides.
5. Ground every claim, number, and name in the provided materials. Where something is missing, insert a clearly marked placeholder like [ADD: Q3 revenue figure] instead of inventing it.
6. End with a slide that states the specific ask or next steps.

Output format (Markdown):
- First, a "Core message" line.
- Then each slide as:
  ### Slide N: <Takeaway title>
  **On the slide:** bullets
  **Visual:** a suggested chart, diagram, image, or layout
  **Speaker notes:** 2-4 sentences the presenter can say
- Finish with a short "Open questions / placeholders to fill" list if any placeholders were used.`,
};
