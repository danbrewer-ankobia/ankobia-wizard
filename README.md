# Ankobia Wizard

An internal web app that helps people new to AI make polished work documents. Users finish the sentence **"I want to make a ___"** (slide deck, executive summary, detailed overview, step-by-step instructions, demo script, …), answer a few guided questions, drop in whatever they already have, and the wizard sends a well-built prompt to the AI and streams back the result.

## Features

- **Guided questions** per item type that fill a robust prompt template.
- **Two input boxes**: "What do you already have?" (file drop + paste) and "Anything else the AI should know?".
- **File input**: PDF and images go to Claude natively; Word (.docx), PowerPoint (.pptx), and text files are converted to text.
- **See the prompt**: shows exactly what is sent, so users learn prompting as they go.
- **Admin (/admin)**:
  - Prompt library editor: add, edit, reorder, and delete items, their questions and templates, plus the shared "house rules" system prompt. Reset to defaults any time.
  - AI settings: choose an AI provider (Claude today; ChatGPT, Gemini and an in-house AI are listed as coming soon), enter its API key (encrypted on the server, test connection), then configure which models people can pick, the default model, and response depth (Quick / Balanced / Thorough).
  - The server also supports in-house models through any OpenAI-compatible `/chat/completions` endpoint; the screen for adding them comes with the "in-house AI" option.

## Run locally

Requires Node 20+ and pnpm 10 (`npm i -g pnpm@10`).

```bash
pnpm install
cp .env.example .env.local   # then set ADMIN_PASSWORD, ADMIN_SECRET, ANTHROPIC_API_KEY
pnpm dev
```

Open http://localhost:3100 for the wizard and http://localhost:3100/admin for settings.

## Project layout

| Path | What it is |
|---|---|
| `src/components/Wizard.tsx` | The main "I want to make a ___" page |
| `src/components/admin/` | Admin sign-in, prompt library editor, models panel |
| `src/prompts/` | Built-in default prompt library (one file per item) and house rules |
| `src/lib/prompt.ts` | Builds the final prompt (shared by server and the browser preview) |
| `src/lib/providers.ts` | Claude and OpenAI-compatible provider adapters |
| `src/lib/files.ts` | Upload handling and text extraction |
| `src/lib/settings.ts`, `library.ts`, `store.ts` | Admin settings, editable library, JSON file store |
| `src/app/api/` | Route handlers: `generate`, `config`, `admin/*` |

## Hosting

This app needs a server: it calls AI APIs with secret keys and stores admin settings. Static hosts such as GitHub Pages can't run it. Good fits for an internal deployment are AWS (ECS/App Runner alongside existing Ankobia services) or Vercel, with:

- `ADMIN_PASSWORD`, `ADMIN_SECRET` (and optionally `ANTHROPIC_API_KEY`) set as secrets.
- `DATA_DIR` on persistent storage, or `src/lib/store.ts` swapped for a database or AWS Secrets Manager/SSM when running more than one instance.
- Access limited to Ankobia staff (VPN/private network now; Microsoft Entra sign-in planned).
