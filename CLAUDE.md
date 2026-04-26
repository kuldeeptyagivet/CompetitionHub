# CLAUDE.md — CompetitionHub Test Generator

## What This App Does
A standalone single-file HTML test generator for students preparing
for competitive exams. Reads question bank JSON files, filters by
book/chapter/difficulty/type/bloom level, assembles test papers,
renders math with KaTeX, and produces print-ready output.

---

## Tech Stack
- **Runtime**: Vanilla JS (no build step, no framework)
- **Single file**: All HTML, CSS, JS in `index.html`
- **Fonts**: Google Fonts — DM Serif Display, DM Sans, DM Mono
- **Math rendering**: KaTeX (CDN)
- **Data source (local)**: File System Access API reads from
  GithubUpload folder on local machine
- **Data source (remote)**: Cloudflare Worker fetch with access key
- **Hosting**: Cloudflare Pages (auto-deploys on git push)
- **Repository**: https://github.com/kuldeeptyagivet/CompetitionHub
- **Live URL**: https://competitionhub.pages.dev

---

## Directory Structure
```
CompetitionHub/
├── index.html    — entire application (single file)
├── CLAUDE.md     — this file
├── DEVLOG.md     — session log
```

---

## CONFIG Object
Single config object at top of JS controls data source mode:

```javascript
const CONFIG = {
  mode: 'local',   // 'local' | 'remote'
  workerUrl: 'https://qbank.yourname.workers.dev',
  accessKey: ''
};
```

Local mode: FSA reads from GithubUpload folder directly.
Remote mode: fetches from Cloudflare Worker with access key.
Switching between modes requires changing one string only.

---

## Data Format
Question bank files follow QB_QUESTION_SCHEMA defined in the
QuestionBankCreation app. Key fields used by this app:

```
question_id     — unique identifier
source_type     — extracted | modified | created
type            — mcq_single | mcq_multi | assertion_reason
                  | statement_based | match_following
stem            — question text (LaTeX for math)
stem_figure     — CDN URL or null
options         — [{key, text, figure}]
correct         — answer key string
difficulty      — easy | medium | hard
marks           — integer
bloom_level     — remember | understand | apply | analyze | evaluate
concept_tags    — array of strings
topic_heading   — string or null
topic_subheading — string or null
verified        — boolean
source          — {book, chapter, section, page}
hint            — string or null
solution        — string or null
assertion       — string or null (assertion_reason type)
reason          — string or null (assertion_reason type)
statements      — array or null (statement_based type)
list_i          — array or null (match_following type)
list_ii         — array or null (match_following type)
modified_from   — parent question_id or null
```

Index file structure (`_index.json`):
```json
{
  "book": "ARIHAN_SAI6",
  "title": "...",
  "files": [
    {
      "file": "CH11_S1.json",
      "chapter": 11,
      "chapter_name": "Simple Interest",
      "section": "1",
      "section_name": "Mathematics",
      "count": 58,
      "updated": "2026-04-26"
    }
  ]
}
```

---

## Architecture and Key Patterns

**Tab-based UI**: Single page with tab navigation. Tabs: Filter,
Select, Assemble, Preview/Print. Each tab is a div.tab-panel
toggled by class active.

**CONFIG-driven data layer**: All data fetching goes through a
single getData(path) function that switches between FSA and
Worker fetch based on CONFIG.mode. Swapping modes requires no
other code changes.

**Filter state**: Stored in a plain filterState object. Changing
any filter re-runs the question fetch and renders the selector.

**Paper state**: Selected questions stored in paper.questions
array. Order can be rearranged. Metadata (title, date, duration,
total marks) stored in paper.meta.

**KaTeX rendering**: renderMath(el) utility scans a DOM element
and renders all $...$ and $$...$$ expressions found. Called
wherever question text is displayed.

**CSS variables**: Consistent design tokens in :root matching
QuestionBankCreation app palette — --ink, --paper, --cream,
--accent, --accent2, --gold, --muted, --border, --success, --warn.

---

## Current State

**Working:**
- Placeholder index.html deployed to Cloudflare Pages
- Auto-deploy pipeline confirmed working

**Not yet built:**
- App shell and tab navigation
- Local data layer (FSA)
- Question filter UI
- Question selector
- Paper assembler
- KaTeX rendering
- Print layout
- Remote data layer (Cloudflare Worker)
- User access control

---

## Conventions
- Single CONFIG object controls all environment switching
- All data access through getData(path) — never direct FSA or
  fetch calls outside this function
- Function naming: filterXxx() for filter tab, selectXxx() for
  selector tab, paperXxx() for assembler tab
- No external JS framework — all DOM manipulation is vanilla JS
- Inline styles used sparingly; static styles in style block

---

## Shortcut Commands
When I write any of the following, treat it as an instruction:

**/start** — Read this file and the last entry of DEVLOG.md.
Confirm current state and await task.

**/done** — Append a session entry to DEVLOG.md covering: what
changed, decisions made, next step. Then update only the Current
State section of this file where something has changed. Always
append a COMMIT: line as the absolute last line of DEVLOG.md
(no blank line after it) with a conventional commit message.

**/plan [task]** — Before writing any code, outline the approach
for [task], list which functions and sections of index.html will
be touched, and wait for confirmation before proceeding.

**/next** — Based on the not yet built sections above, suggest
the single most logical next development task with a brief
rationale.

**/state** — Summarise current app state from this file in five
lines or fewer.
