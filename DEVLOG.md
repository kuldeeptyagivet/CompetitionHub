# DEVLOG.md — CompetitionHub Test Generator
Append-only session log. Most recent entry at bottom.
When reading, load only the last entry unless full history requested.

---

## Session 01 — 2026-04-26

**State at session start:**
Project initialised. Placeholder index.html pushed to GitHub at
https://github.com/kuldeeptyagivet/CompetitionHub. Cloudflare Pages
connected and auto-deploy confirmed working at
https://competitionhub.pages.dev.

**What exists:**
Single placeholder index.html with "Competition Hub" heading only.
No app functionality built yet.

**What was done this session:**
- GitHub repository created: kuldeeptyagivet/CompetitionHub
- Local folder created: G:\My Drive\AppDevelopment\CompetitionHub
- Cloudflare Pages connected, auto-deploy pipeline confirmed
- CLAUDE.md and DEVLOG.md created
- Two-layer workflow established: Claude Project for planning,
  Claude Code for execution

**Decisions made:**
- Standalone app separate from QuestionBankCreation by design
- Single CONFIG object controls local vs remote data source mode
- Local mode uses FSA to read from GithubUpload folder
- Remote mode uses Cloudflare Worker with per-user access keys
- All data access through single getData(path) function
- KaTeX for math rendering (lightweight, fast, Claude-compatible)
- Same CSS variable palette as QuestionBankCreation for consistency

**Next immediate step:**
Part 01 — App shell: tab navigation, CONFIG object, basic layout.

---

## Session 02 — 2026-04-26

**State at session start:**
Placeholder index.html only. No app functionality built.

**What was done this session:**
- Built full app shell in index.html
- Full DOCTYPE, charset, viewport, title set
- Google Fonts imported: DM Serif Display, DM Sans, DM Mono
- All 10 CSS variables defined in :root
- Header with app title and four tab buttons
- Tab switching via data-tab attributes, one active at a time
- CONFIG object added exactly as specified in CLAUDE.md
- getData(path) stub added, logs per mode, returns null
- Each tab panel contains placeholder text only
- #auth-overlay added with full viewport coverage and dismiss
  button for dev access
- Fixed auth overlay not appearing on first load: replaced
  inset:0 with explicit top/right/bottom/left:0 plus
  width/height 100%

**Decisions made:**
- No framework, no build step confirmed
- All functionality will be added to this single file
- inset:0 unreliable in some rendering contexts — use explicit
  positional properties going forward
- Workflow revised: menu-driven prompts replace shortcut commands.
  Planning layer owns part sequencing, prompt generation, and log
  content. Claude Code executes only. Log entry content always
  provided by planning layer, never inferred by Claude Code.

**Next immediate step:**
Part 02 — Local data layer: FSA folder picker, read _index.json,
list available books and chapters.

COMMIT: feat: app shell with tab navigation, CONFIG, getData stub, auth overlay | docs: workflow revised to menu-driven model
