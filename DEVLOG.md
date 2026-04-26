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
- Implemented local data layer: FSA picker at QuestionBank
  root, reads _books_registry.json, navigates GithubUpload/,
  reads each book's _index.json using book.code as subfolder
  name, merges into bookData module-level variable
- Fixed book loop bug: registry.books used instead of registry
- Rendered book title, subject/class/board subheading,
  chapter list with question counts
- Fixed subheading visibility: color and opacity adjusted
- Chapter count label changed from "q" to "questions"

**Decisions made:**
- No framework, no build step confirmed
- All functionality will be added to this single file
- inset:0 unreliable in some rendering contexts — use explicit
  positional properties going forward
- Workflow revised: menu-driven prompts replace shortcut
  commands. Planning layer owns part sequencing, prompt
  generation, and log content. Claude Code executes only.
- User picks QuestionBank root folder. App navigates into
  GithubUpload/ automatically. book.code is the subfolder name.
- _books_registry.json is the authoritative book list.
  getData() traverses path segments from root folderHandle.
- Development sequence revised: Parts 03-05 redesigned to
  match actual UX flow — filter, test parameters, generation.

**Next immediate step:**
Part 03 — Filter UI: multi-select books, multi-select chapters,
filter by type/difficulty/bloom_level/source_type, live
question count display.

COMMIT: feat: local data layer complete | docs: session 02 log

---

## Session 03 — 2026-04-26

**State at session start:**
App shell complete. Local data layer complete. Filter tab shows
book titles, subject/class/board subheading, chapter list with
counts after folder load.

**What was done this session:**
- Built filter panel inside Filter tab panel
- Books — vertical checkbox list, one per book in bookData
- Chapters — vertical checkbox list, re-renders on book toggle;
  chapter labels include book title when multiple books loaded
- Chapter keys use bookCode::filename format for uniqueness
  across books
- Type / Difficulty / Bloom Level / Source Type — horizontal
  wrapping checkbox groups with fixed values
- Live count bar — sums chapter counts from selected chapters;
  prefixed with ~ when any type/difficulty/bloom/source filter
  is not fully selected
- filterState object with Sets for books, chapters, types,
  difficulties, bloomLevels, sourceTypes
- filterUpdateCount() is single recompute function for all
  filter changes
- filterInitState() resets all Sets to all-selected on each
  folder load
- filterRenderChapters() re-renders chapter list on book toggle
- Deselecting a book clears its chapters from filterState and
  re-renders chapter list
- Verified: 110 count matches sum of chapter counts in index

**Decisions made:**
- Chapter keys are bookCode::filename — unambiguous across books
- Count approximation uses ~ prefix only when subset of
  type/difficulty/bloom/source is selected; chapter-level
  breakdown by these fields not available without loading JSON
- Filter panel hidden until folder is loaded, shown by
  filterRenderPanel()

**Next immediate step:**
Part 04 — Test parameters: number of questions input, marks per
question, negative marking toggle, duration auto-calculated
from avg_time_sec of selected questions.

COMMIT: wip: part 03 filter UI
