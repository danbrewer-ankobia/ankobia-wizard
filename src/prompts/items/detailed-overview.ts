import type { PromptItem } from "../types";

export const detailedOverview: PromptItem = {
  id: "detailed-overview",
  label: "detailed overview",
  article: "a",
  summary: "A thorough, well-organized explanation of a product, project, process, or topic.",
  materialsHint: "Product docs, project plans, specs, notes, or anything describing the subject.",
  fields: [
    {
      id: "subject",
      label: "What is the overview about?",
      type: "text",
      placeholder: "e.g. Our eBonds platform, the Kobi 2.0 project",
    },
    {
      id: "audience",
      label: "Who is it for?",
      type: "select",
      options: ["New team members", "Customers or partners", "Leadership", "Technical staff", "General audience"],
      default: "New team members",
    },
    {
      id: "depth",
      label: "How deep should it go?",
      type: "select",
      options: ["High-level (2-3 pages)", "Moderate (4-6 pages)", "Comprehensive reference"],
      default: "Moderate (4-6 pages)",
    },
    {
      id: "sections",
      label: "Any sections you definitely want?",
      type: "textarea",
      placeholder: "e.g. Architecture, roles, FAQ, glossary",
      optional: true,
    },
  ],
  template: `Write a detailed overview document.

Subject: {{subject}}
Audience: {{audience}}
Depth: {{depth}}
Requested sections: {{sections}}

Guidelines:
1. Open with a short "At a glance" summary (3-5 bullets) so a reader gets the essentials in 30 seconds.
2. Organize the body logically for this audience. A typical structure: purpose and context, how it works or what it includes, key components or roles, benefits and limitations, and how to get started or who to contact. Adapt it; include every requested section.
3. Explain concepts in plain language before using specialist terms, and define acronyms the first time.
4. Use headings, short paragraphs, bullets, and tables where they help comparison.
5. Base the content on the provided materials. Do not invent features, numbers, or commitments; use [ADD: …] placeholders where information is missing.
6. Close with "Key takeaways" and, if useful, a glossary.

Output format: well-structured Markdown with # and ## headings.`,
};
