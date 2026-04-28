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
- App shell built: tab navigation, CONFIG object, getData stub,
  auth overlay with dismiss button
- Local data layer complete: FSA folder picker points to
  QuestionBank root, reads _books_registry.json, navigates
  into GithubUpload/, reads each book's _index.json via
  book.code as subfolder name, merges registry metadata with
  chapter data into bookData, renders book title, subject/
  class/board subheading, and chapter list with counts
- Filter UI complete: multi-select Books, Chapters, Type,
  Difficulty, Bloom Level, Source Type
- Question JSON loaded on demand per selected chapter via
  filterLoadSelectedChapters(); stored in loadedQuestions{}
- Exact filter counts computed from loadedQuestions across
  all four fields (type, difficulty, bloom_level, source_type)
- Faceted counts shown next to every checkbox via
  filterUpdateFacets(); updates in place without DOM rebuild
- Books and chapters default to unselected on folder load;
  no JSON fetch fires until user selects at least one chapter;
  count bar shows "Select books and chapters to begin" until
  a chapter is selected
- Test parameters panel: questionCount, marksPerQ,
  negativeMarking, negativeMarksPerQ stored in paperParams;
  total marks computed; est. duration computed as mean
  avg_time_sec across filtered pool × questionCount, prefixed
  with ~; panel hidden when filtered count is 0
- Test generation complete: paperGenerate() Fisher-Yates
  shuffles filtered pool, slices N questions, computes exact
  duration, assembles paper object with crypto.randomUUID();
  switches to Select tab
- Select tab complete: summary bar with editable title, date,
  exact duration, total marks, question count; ordered question
  list with type badge, stem, difficulty (colour-coded) and
  bloom tags; Regenerate and Proceed to Print buttons
- KaTeX rendering complete: CDN loaded in head, renderMath(el)
  utility with four delimiter pairs and throwOnError: false;
  wired to selectRender() and previewRender()
- Print layout complete: three-page print output — exam paper
  (header, instructions, questions by type), answer key (grid,
  paper title, date, page break), hints and solutions (per
  question, skips null fields, page break); print CSS hides
  app chrome; screen view has Print and Back to Select buttons
- Paper logging complete: paperSave() appends full paper entry
  (id, title, date, duration, totalMarks, questionCount,
  questions, createdAt) to ch_papers in localStorage; called
  inside paperGenerate() before selectRender(); title input
  listener in selectRender() updates matching localStorage entry
  on every keystroke so edited titles persist correctly
- History tab complete: renders ch_papers newest-first; each
  entry shows title, date, marks, question count, createdAt;
  Load restores paper to Select tab; Delete removes entry and
  re-renders; empty state shows "No saved papers yet."; list
  re-renders on every tab click
- CBT attempt screen complete: NTA-style interface with question
  palette (five status colours), countdown timer parsed from
  paper.meta.duration, Save & Next / Mark for Review / Clear
  Response / Back / Next controls, submit confirmation flow,
  result screen with score summary and full question-by-question
  breakdown with correct/wrong answer highlighting and KaTeX
  rendering
- CBT attempt history complete: attempts saved to ch_attempts
  in localStorage on submit; each response entry stores
  source_book and source_chapter; History tab has Saved Papers
  / Progress toggle
- Progress panel complete: cascading book → chapter multi-select
  filter with Apply button; per-chapter report cards showing
  total attempted, accuracy %, last attempted date; collapsible
  attempt rows with chapter-slice correct/incorrect/unattempted
  counts and View Result button
- Question Analysis complete: per-chapter panel aggregates all
  responses by question_id, computes failure rate
  (unsuccessful/total), sorts weakest first; truncated stems
  expandable with KaTeX rendered on expand; threshold input
  auto-selects questions above user-defined failure %; Generate
  Retest assembles paper from selected questions in failure-rate
  order, saves via paperSave(), switches to Select tab
- Start CBT button added to Select tab
- OMR answer entry complete: Enter Answers button on each saved paper in History tab loads paper into an OMR panel inside the CBT tab; grid of numbered question cards with radio buttons (mcq_single, assertion_reason, match_following), checkboxes (mcq_multi), and per-question Clear buttons; Submit confirmation flow with answered/unanswered counts; result and attempt saving identical to CBT mode; Back button returns to History without submitting

**Not yet built:**
- Answer logging and scoring
- Remote data layer (Cloudflare Worker)
- User access control
- D1 sync

---

## Decisions Log

2026-04-26 — Single CONFIG object controls local vs remote
  mode; all data access through getData(path) so switching
  modes requires no other code changes.
2026-04-26 — Chapter keys use bookCode::filename format to
  remain unambiguous when multiple books are loaded.
2026-04-26 — Question JSON loaded on demand per selected
  chapter (not at folder-load time) to keep remote mode
  efficient; in-memory filtering for type/difficulty/bloom/
  source requires no re-fetch when those filters change.
2026-04-26 — DEVLOG.md removed; decisions appended here
  instead; git history covers what changed and when.
2026-04-26 — Books and chapters default to unselected on folder
  load; JSON fetch deferred until user makes explicit selection
  to keep the app performant with large question banks.
2026-04-27 — Duration shown in parameters panel is an
  estimate (mean avg_time_sec × question count); exact
  duration computed at paper assembly in Part 05.
2026-04-27 — Paper logging uses localStorage in Part 08;
  D1 sync deferred to Part 13 after Worker is built.
2026-04-27 — CBT attempt screen follows NTA interface
  pattern: question palette, colour coding, countdown
  timer, Save & Next flow; built in Part 09.
2026-04-27 — Print mode supports manual answer logging:
  user prints, attempts on paper, returns to app to
  enter answers; same scoring endpoint as CBT mode.
2026-04-28 — Title saved to localStorage on every keystroke
  via the input event listener in selectRender(), not at paper
  assembly time, so the stored title always reflects the final
  edited value.
2026-04-28 — CBT attempt screen follows NTA interface pattern:
  question palette, colour coding, countdown timer, Save & Next
  flow; built in Part 09.
2026-04-28 — Progress panel groups attempt history by book and
  chapter rather than by date; each response entry stores
  source_book and source_chapter at save time to enable
  chapter-slice performance without reconstructing question
  metadata later.
2026-04-28 — Question Analysis failure rate = unsuccessful
  attempts / total attempts per question_id; Generate Retest
  assembles paper in failure-rate order so weakest questions
  appear first.
2026-04-28 — OMR panel renders inside #tab-cbt using the same display-flag pattern as CBT attempt and result screens; responses are passed directly to cbtShowResult() so print-mode attempts appear in Progress and Question Analysis identically to CBT attempts.
2026-04-28 — _books_registry.json moved inside GithubUpload folder; FSA data layer updated to read it from within GithubUpload so local folder structure matches R2 layout exactly; user picks QuestionBank as root, app navigates into GithubUpload for all file reads.

---

## Workflow

Every development part follows this sequence:

1. Open Claude Code with the session-opening prompt from the
   planning layer. Claude Code reads CLAUDE.md, confirms
   current state, awaits instruction.

2. Receive scoped part prompt from planning layer. Paste into
   Claude Code. Claude Code states understanding in two
   sentences, awaits confirmation before writing any code.

3. Claude Code builds the part. Push a wip: commit with
   git add index.html only.

4. Verify live at https://competitionhub.pages.dev. Report
   back to planning layer.

5. Planning layer reviews. If fixes needed, a fix prompt is
   generated. Repeat steps 3-4 until clean.

6. Planning layer generates a single update prompt with new
   Current State text and any Decisions Log entries.

7. Claude Code updates CLAUDE.md, then runs:
   git add index.html CLAUDE.md
   git commit -m "docs: update after part N"
   git push
   Confirms with commit hash.

8. User copies updated CLAUDE.md into project knowledge.

---

## Claude Code Menu

When I write "menu" in Claude Code, respond with exactly this
and nothing else:

1. Continue current part
2. Fix a bug
3. Update CLAUDE.md (Current State + Decisions Log)
4. Push to GitHub

When I write a number, execute that option immediately.

Option 1: Await the next instruction or scoped prompt.

Option 2: State the bug in one sentence and which file you
will touch. Await confirmation before making any change.

Option 3: Await the Current State text and any Decisions Log
entries to be pasted. Write exactly what is provided into
CLAUDE.md. Make no other changes.

Option 4: Run the following and confirm with commit hash:
git add index.html CLAUDE.md
git commit -m "docs: update after part"
git push
