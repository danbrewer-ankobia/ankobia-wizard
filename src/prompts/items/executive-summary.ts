import type { PromptItem } from "../types";

export const executiveSummary: PromptItem = {
  id: "executive-summary",
  label: "executive summary",
  article: "an",
  summary: "A one-page, decision-ready summary for busy leaders.",
  materialsHint: "A report, proposal, project update, research, or long email thread to summarize.",
  fields: [
    {
      id: "reader",
      label: "Who will read it?",
      type: "text",
      placeholder: "e.g. CEO and board, client's IT director",
    },
    {
      id: "purpose",
      label: "What is it for?",
      type: "select",
      options: ["Request a decision or approval", "Report status or results", "Propose a new initiative", "Summarize research or findings"],
      default: "Request a decision or approval",
    },
    {
      id: "length",
      label: "Length",
      type: "select",
      options: ["Half a page (~200 words)", "One page (~400 words)", "Up to two pages (~800 words)"],
      default: "One page (~400 words)",
    },
    {
      id: "emphasis",
      label: "Anything to emphasize?",
      type: "textarea",
      placeholder: "e.g. Cost savings, risk, timeline",
      optional: true,
    },
  ],
  template: `Write an executive summary.

Reader: {{reader}}
Purpose: {{purpose}}
Length: {{length}}
Emphasize: {{emphasis}}

Guidelines:
1. Lead with the bottom line: the first two sentences must state the main conclusion and, if relevant, the decision or action needed.
2. Then cover, in this order and only as needed: background (brief), key findings or status, options or recommendation, impact (cost, time, risk, benefit), and next steps with owners and dates where known.
3. Write for a busy senior reader: plain language, short paragraphs, no jargon unless the reader uses it. Use bullets for lists of findings or steps.
4. Quantify wherever the materials allow (numbers, percentages, dates, dollars). Do not invent figures; insert [ADD: …] placeholders for missing facts.
5. Stay within the requested length.

Output format (Markdown):
# <Clear, specific title>
**Bottom line:** <1-2 sentences>
Then short sections with bold lead-ins (e.g. **Background**, **Key findings**, **Recommendation**, **Next steps**).`,
};
