# Ankobia Wizard

An internal web app that helps people new to AI make polished work documents. Users finish the sentence **"I want to make a ___"** (slide deck, executive summary, detailed overview, step-by-step instructions, demo script, …), answer a few guided questions, drop in whatever they already have, and the wizard sends a well-built prompt to the AI and streams back the result.

## Quick start (Windows)

You need **Node.js 20 or newer**. If you don't have it, install the LTS version from [nodejs.org](https://nodejs.org) (accept the defaults).

1. **Get the app.** On this GitHub page click **Code → Download ZIP**, then unzip it somewhere outside OneDrive (for example `C:\Ankobia\ankobia-wizard`). Or, with Git: `git clone https://github.com/danbrewer-ankobia/ankobia-wizard.git`.
2. **Double-click `Start Wizard.cmd`** in that folder.
   - The first time, it asks you to choose an **admin password** (or press Enter to generate one), installs what it needs, and builds the app. This takes a few minutes.
   - If Windows asks whether you want to run a downloaded file, choose **Run** (or **More info → Run anyway**).
3. Your browser opens **http://localhost:3100**. Go to **Admin** (top right), sign in, and on **AI models & keys**:
   - paste your Claude API key ([console.anthropic.com](https://console.anthropic.com) → API keys) and click **Save key**,
   - click **Test connection**.
4. Back on the Wizard page, pick what you want to make and go.

Keep the black server window open while you use the Wizard; close it to stop. Next time, just double-click `Start Wizard.cmd` again; it starts in seconds.

**Mac or Linux:** in a terminal in the app folder, run `./start-wizard.sh` (same steps).

**Forgot the admin password?** It's in the `.env.local` file in the app folder. To start over completely, delete `.env.local` and the `data` folder, then run the start script again.

## Features

- **Guided questions** per item type that fill a robust prompt template.
- **Two input boxes**: "What do you already have?" (file drop + paste) and "Anything else the AI should know?".
- **File input**: PDF and images go to Claude natively; Word (.docx), PowerPoint (.pptx), and text files are converted to text.
- **See the prompt**: shows exactly what is sent, so users learn prompting as they go.
- **Admin (/admin)**:
  - Prompt library editor: add, edit, reorder, and delete items, their questions and templates, plus the shared "house rules" system prompt. Reset to defaults any time.
  - AI settings: choose an AI provider (Claude today; ChatGPT, Gemini and an in-house AI are listed as coming soon), enter its API key (encrypted on the server, test connection), then configure which models people can pick, the default model, and response depth (Quick / Balanced / Thorough).
  - The server also supports in-house models through any OpenAI-compatible `/chat/completions` endpoint; the screen for adding them comes with the "in-house AI" option.

## Development

Requires Node 20+ and pnpm 10 (`npm i -g pnpm@10`).

```bash
pnpm install
cp .env.example .env.local   # then set ADMIN_PASSWORD, ADMIN_SECRET, ANTHROPIC_API_KEY
pnpm dev
```

Open http://localhost:3100 for the wizard and http://localhost:3100/admin for settings.

Start scripts: `Start Wizard.cmd` / `start-wizard.ps1` (Windows) and `start-wizard.sh` (macOS/Linux) accept `-Rebuild` / `--rebuild` to force a build and `-NoStart` / `--no-start` to set up and build without starting.

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
