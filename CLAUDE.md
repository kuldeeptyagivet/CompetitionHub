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
- **Live URL**: https://app.examsindia.org (also https://competitionhub.pages.dev)

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
- Remote data layer complete: Cloudflare Worker (competitionhub-qbank.kuldeeptyagi-vet.workers.dev) serves question bank JSON from R2 bucket (competitionhub-qbank); Worker validates x-access-key header; getData() switches between FSA and Worker fetch based on CONFIG.mode; remote mode auto-connects on page load without folder picker; GithubUpload/ prefix stripped from paths in remote branch
- Worker accessible at api.examsindia.org (custom domain); CF Access service token headers sent with every remote fetch; app auto-detects local vs remote mode based on location.hostname and location.protocol
- Cloudflare Access gate on competitionhub.pages.dev: email OTP
  authentication required; Everyone policy allows any verified email
- D1 database competitionhub-db bound to Worker as DB; tables:
  plans, users, question_overrides, announcements, user_notes,
  messages; superadmin drtyagivet@gmail.com seeded on pro plan
- Auth state: authState object holds email, role, plan after
  authInit(); local mode hardcodes superadmin email; remote mode
  reads identity from /cdn-cgi/access/get-identity then fetches
  /user-plan from Worker
- Worker enforcement: resolveUserPlan() reads x-user-email header,
  queries D1 for user + plan, auto-provisions new users on free
  plan, checks is_active flag; enforces max_books on book list,
  filters extracted questions if allow_extracted=0
- Plan note shown below question count input: "Your plan allows
  up to N questions per test"; input capped to plan max
- Admin tab: visible to superadmin and admin roles only; four
  sub-panels: Users (superadmin), Plans (superadmin),
  Announcements (superadmin), Messages (both roles)
- Superadmin can create/edit users, assign plans, set expiry,
  activate/deactivate, add internal notes per user
- Superadmin can create/edit plans with all parameters
- Announcement banner: dismissible, persists dismissal in
  localStorage, fetches active announcements after auth
- Messages: inbox with unread highlighting, reply by thread,
  compose to any email; unread badge on Admin tab refreshes
  every 60 seconds
- D1 sync complete: workerPost(path, body) fire-and-forget helper
  gates all sync on CONFIG.mode === 'remote'; paperSave() POSTs to
  /save-paper after localStorage write; cbtShowResult() POSTs to
  /save-attempt after localStorage write; syncFromCloud() fetches
  /get-papers and /get-attempts in parallel on remote-mode load,
  merges into localStorage via mergeRecords() with D1 winning on
  ID collision; Worker gains initTables() with module-level guard,
  INSERT OR REPLACE handlers for both tables, and GET handlers
  returning all rows for authenticated user; local mode untouched
- User info bar complete: #user-bar injected into app header
  after authInit() resolves; shows authState.email and a Sign
  Out link in remote mode only; Sign Out href derived from
  window.location.hostname at runtime so it works on both
  app.examsindia.org and competitionhub.pages.dev; local mode
  shows email only, no Sign Out link; styled with existing CSS
  variables
- Wrangler auto-deploy pipeline complete: wrangler.toml at repo
  root configured with Worker name competitionhub-qbank, D1
  binding DB (competitionhub-db), R2 binding QBANK
  (competitionhub-qbank); GitHub Actions workflow at
  .github/workflows/deploy-worker.yml triggers on changes to
  worker.js or wrangler.toml only; CLOUDFLARE_API_TOKEN and
  CLOUDFLARE_ACCOUNT_ID stored as GitHub repo secrets; pipeline
  verified green on first run; Worker deploys automatically
  within ~30 seconds of any push touching worker.js
- Source Type filter bifurcated into five computed categories: extracted (leaf), extracted_parent (has ≥1 child in loaded set), extracted_child, modified, created; extracted_child unchecked by default; checking it reveals inline "Max per parent" number input stored in filterState.childCapPerParent; parameters panel duration estimate includes expected children time weighted by cap and updates live on cap input change
- buildParentChildIndexes() builds childrenByParent map and extractedParentIds Set after every chapter load/evict cycle using q.parent_id field; sourceTypeMatchesMain(q) helper resolves all source type filter logic for main questions
- paperGenerate() iterates shuffled main pool with a remaining counter; each main question costs 1 slot, its children consume min(children.length, cap, remaining) additional slots; stops when remaining === 0; total always ≤ N; paper.questions is finalQuestions containing both main and child questions
- Count bar shows static muted note "— children fill slots when parent selected" only when extracted_child is checked and cap > 0; Type/Difficulty/Bloom facet counts include extracted_child questions when extracted child Source Type checkbox is checked
- Topic heading filter complete: each chapter row has a ▶/▼ chevron; clicking expands indented heading sub-rows with checkboxes and question counts; selecting a chapter auto-populates all its headings into headingSelections so all heading checkboxes render checked by default; unchecking a chapter clears its headingSelections entry and re-renders heading sub-rows immediately via filterRenderChapters(); user can uncheck the chapter then select individual headings to filter by specific topics only; headingPassesFilter() returns false when headingSelections is absent or empty so unselected chapters contribute zero questions; applied in both filterUpdateCount() and paramGetFilteredPool(); headingIndex built after every chapter load/evict via buildHeadingIndex() counting all questions including extracted_child; filterRenderChapters() called at end of filterLoadSelectedChapters() so heading checkboxes always reflect current headingSelections state; extracted_child questions included in all filter counts (count bar, all four facet sections, chapter counts) when extracted child Source Type checkbox is checked; headingPassesFilter() applied to extracted_child counts in all computeFacet() branches including source branch so heading deselection reduces child counts correctly everywhere
- Per-question time tracking complete: cbtRender() gains overtime,
  paused, timeOnQuestion, focusTimestamp fields; cbtFlushQuestionTime()
  accumulates elapsed time for current question on every navigation
  event; timeOnQuestion keyed by question_id, values in seconds;
  OMR path initialised with same four fields
- Pause/Resume complete: cbtPause() flushes time and injects PAUSED
  overlay hiding question area; cbtResume() clears overlay and resets
  focusTimestamp; Pause button in CBT header before Submit
- Timer overtime complete: auto-submit on expiry removed; timer flips
  to red +MM:SS count-up after zero; tick skipped while paused
- Attempt record updated: cbtShowResult() attaches time_per_question
  object and time_taken_seconds (sum of all per-question times) to
  attempt record on submit; D1 sync picks up new fields automatically
  via existing blob storage
- Progress panel updated: time_taken_seconds shown as MM:SS per
  attempt row; old records without field show —
- CBT bug fixes complete: cbtGoTo() blocks navigation while paused;
  last question renders "Save" button label instead of "Save & Next";
  palette re-renders explicitly after save on last question so status
  turns green immediately; result breakdown gains Time column showing
  MM:SS per question from time_per_question, — where absent
- Mark for Review bug fixed: save action always sets status to
  'answered' regardless of prior review state; review flag cleared
  on every save so palette turns green correctly after a reviewed
  question is answered
- Three duration fields on Select tab complete: paperComputeDurations()
  derives estimated (sum of avg_time_sec), student average (per-question
  hybrid from ch_attempts time_per_question with avg_time_sec fallback),
  and custom (user-supplied minutes); student average shown only when at
  least one attempt record contains time_per_question data
- Duration radio selector complete: three-row panel in selectRender()
  replaces static duration display; default selection is Student Average
  when available, otherwise Estimated; custom input accepts minutes;
  selected source and resolved seconds stored in
  paper.meta.selectedDurationSource and paper.meta.selectedDuration
- paperPersistSelection() writes selectedDurationSource, selectedDuration,
  customDurationMin back to ch_papers localStorage on every radio change
  and custom input keystroke
- CBT timer reads paper.meta.selectedDuration as countdown start value;
  falls back to parseDuration for old records without the field
- History Load paths (CBT and OMR) restore all three duration fields
  into paper.meta on load
- Figure rendering complete: stem_figure URL from question JSON now
  rendered as <img class="q-figure"> below the stem text in all views —
  Select tab, Preview/Print, CBT live screen, CBT result breakdown, and
  OMR result breakdown; option-level figure field also rendered inside
  each option in all the same views; .q-figure CSS class caps image at
  220px height and is responsive; makeStemBlock() in previewRender()
  extended to accept a second figUrl argument; makeOptionsGrid() now
  destructures figure from each option object
- Delete paper propagation to D1 complete: History tab Delete button
  now calls workerPost('/delete-paper', { paper_id: entry.id }) after
  the localStorage removal; Worker POST /delete-paper route validates
  ownership (WHERE id=? AND user_email=?) before executing DELETE,
  returns {ok: true} on success or 404 if record not found or belongs
  to a different user; fire-and-forget per existing sync pattern;
  syncFromCloud() and mergeRecords() untouched
- Title edit sync to D1 complete: title input listener in selectRender()
  debounces workerPost('/save-paper', ...) at 800ms via module-level
  titleSyncTimer; entry re-read from localStorage inside timeout callback
  so the POST always carries the latest title, not a keystroke-time
  snapshot; paperGenerate() no longer calls workerPost — initial paper
  save to D1 is handled by the first title-sync fire after the user edits
  the title, preventing a race between paper generation and cloud sync
- CBT tab lock complete: module-level cbtSessionActive flag set true inside
  cbtRenderAttempt() and false inside cbtShowResult(); tab click handler
  blocks navigation to any non-CBT tab while flag is true and shows a
  2-second inline red warning "Submit or finish the test before switching
  tabs." inside #tab-cbt; duplicate warnings suppressed via class check
- One attempt per paper enforced in History tab: historyRender() checks
  ch_attempts for any record where attempt.paperId === entry.id; if found,
  Load button is omitted entirely and Enter Answers button is disabled and
  greyed out; View Result button in Progress tab unchanged
- Hint/Solution accordions in both result screens: cbtViewAttempt() and
  cbtShowResult() both append collapsible Hint and Solution rows after each
  question row; rows skipped if field is null or empty; renderMath() called
  on content div on first expand only; print layout untouched
- Stale CBT session cleanup complete: module-level cbtSessionComplete flag
  set true in cbtShowResult() and false in cbtRenderAttempt() only; tab
  click handler shows neutral "No active test" message instead of
  re-rendering stale attempt screen when cbtSessionComplete is true; Back
  to History button wipes #tab-cbt innerHTML but does not clear the flag —
  flag resets only when a fresh attempt begins via cbtRenderAttempt()
- Delete attempt propagation complete: History tab Delete button now
  also removes the associated attempt from ch_attempts in localStorage
  (filter by paperId === entry.id) and calls workerPost('/delete-attempt',
  { paper_id: entry.id }) fire-and-forget; Worker POST /delete-attempt
  fetches all attempt rows for the authenticated user, parses each
  attempt_json, finds the row where parsed.paperId matches, deletes by
  D1 primary key id, returns {ok: true} whether or not a matching row
  existed; delete-paper route unchanged
- Orphaned attempt cleanup complete: cleanOrphanedAttempts() reads
  ch_papers to build a Set of known paper IDs, filters ch_attempts to
  remove any entry whose paperId is absent from that Set, writes the
  filtered array back to localStorage, then calls workerPost(
  '/delete-attempts-batch', { attempt_ids: [...] }) fire-and-forget for
  any orphaned attemptId values; called inside syncFromCloud() after
  both merge writes complete (remote mode) and at the end of
  filterPickFolder() after filterLoadBooks() (local mode); Worker POST
  /delete-attempts-batch deletes all matching rows in a single
  DELETE ... WHERE id IN (...) AND user_email=? query, returns
  {ok: true, deleted: N}; empty array short-circuits without querying
- workerPost() URL double-slash bug fixed: leading slash removed from
  four call sites (save-paper, delete-paper, delete-attempt,
  delete-attempts-batch) so all five POSTs resolve correctly against
  CONFIG.workerUrl with no double-slash
- Result breakdown polish: # column pinned to top via align-self:start
  on first grid child so tall question rows no longer centre-align the
  number; question_id shown as a muted monospace "ID: <id>" row
  directly below the answer columns, before Hint and Solution accordions,
  in both cbtShowResult() and cbtViewAttempt()

**Not yet built:**
- Payment integration (Razorpay/Stripe webhook)
- Question flagging by users
- Usage stats dashboard
- Email notifications on plan change

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
2026-04-28 — R2 bucket layout matches local GithubUpload folder exactly; _books_registry.json at bucket root alongside book subfolders; Worker strips no paths — app getData() strips the GithubUpload/ prefix before building the fetch URL so local and remote path construction stay independent.
2026-04-28 — Cloudflare Access removed from Worker after CORS preflight blocking; x-access-key header validation in Worker is sufficient access control for current scale; Access can be re-added when custom domain routing is stable.
2026-04-28 — Auto-detect mode: isLocal derived from location.hostname and location.protocol before CONFIG is defined; mode set dynamically so deployed app always uses remote and local file:// always uses local.
2026-04-30 — Cloudflare Access used for authentication gate;
  email OTP chosen for open registration; Everyone policy at
  Access level; plan-based authorization handled in Worker.
2026-04-30 — Three roles: superadmin, admin, user; stored in
  D1 users table; resolved on every Worker request via
  resolveUserPlan(); new visitors auto-provisioned as free users.
2026-04-30 — plan_expires_at column added to users table for
  future subscription expiry enforcement.
2026-04-30 — corsHeaders() must explicitly list cf-access-client-id
  and cf-access-client-secret in Access-Control-Allow-Headers;
  omitting these blocks all R2 file requests from the browser.
2026-04-30 — OPTIONS preflight handler placed before all auth
  and route logic in Worker so admin route preflights are
  answered without requiring valid auth headers.
2026-04-30 — corsHeaders() updated to accept request parameter
  and return correct Access-Control-Allow-Origin dynamically
  from an allowlist; both competitionhub.pages.dev and
  app.examsindia.org are allowed origins.
2026-04-30 — authInit() uses window.location.hostname for both
  get-identity fetch and Access login redirect so the app works
  correctly on any domain without hardcoded references.
2026-05-01 — D1 sync uses fire-and-forget POSTs so UI is never
  blocked by network; merge on load with cloud-wins-on-collision
  ensures cross-device consistency without a full replace that
  would discard local-only records.
2026-05-01 — Sign Out href team domain derived via
  hostname.replace(/^app\./, '') at runtime; no hardcoded
  domain so the same code works on both production domains.
2026-05-01 — Worker auto-deploy via Wrangler GitHub Action;
  secrets stored in GitHub encrypted secrets store, never in
  repo files; workflow scoped to worker.js and wrangler.toml
  path filters so index.html pushes do not trigger Worker deploy.
2026-05-01 — schema.sql omitted from repo; D1 schema managed
  entirely by initTables() in worker.js; no migrations file to
  drift out of sync with live tables.
2026-05-09 — extracted_parent and extracted_child are computed categories derived at load time from parent_id links; source_type field in JSON remains "extracted" for parents; no schema change required (Path A).
2026-05-09 — Child inclusion is per-parent capped: after main question selection, each selected parent contributes up to childCapPerParent randomly shuffled children; cap=0 suppresses all children regardless of checkbox state.
2026-05-09 — Duration calculation includes children in both paperGenerate() and the parameters panel estimate; children are real time cost; parameters panel estimate updates reactively when cap input changes.
2026-05-09 — Duration in paperGenerate() computed from finalQuestions (main + children); parameters panel estimate uses paramComputeDuration() extended with expected children time; cap input wired to paramUpdateDerived() for live update.
2026-05-09 — extracted_child questions link to their parent via parent_id field, not modified_from; buildParentChildIndexes() uses parent_id exclusively for child-parent mapping.
2026-05-09 — Children consume slots from the same N budget as main questions; total paper size is always ≤ N; parent is always prioritised over its children when slots are tight.
2026-05-09 — topic_heading used as the single filter level; topic_subheading ignored for now; null/empty topic_heading surfaced as "Uncategorised" so no questions are silently excluded from heading selection
2026-05-09 — heading selection model: chapter checked = all headings checked and all questions pass; chapter unchecked = all headings cleared and zero questions pass; user filters by specific headings by unchecking chapter first then selecting individual headings; empty headingSelections returns false not true so chapter state is always explicit; filterRenderChapters() must be called after any headingSelections mutation so DOM reflects state; extracted_child questions counted in all filter totals when extracted_child checkbox is checked; heading filter applies to child counts identically to main question counts
2026-05-18 — Auto-submit on timer expiry removed; timer counts up in
  red after zero with manual submit only; suits self-study context
  where planned duration is a reference not a hard cutoff.
2026-05-18 — Per-question time tracked as cumulative seconds in
  timeOnQuestion object; most recent attempt used when same question
  appears in multiple past attempts; focus timestamp reset on every
  navigation and resume event.
2026-05-18 — Pause freezes both countdown/countup timer and
  timeOnQuestion accumulation; overlay hides question area during
  pause to preserve timing integrity.
2026-05-18 — time_taken_seconds computed as sum of timeOnQuestion
  values not wall-clock difference; more accurate as it excludes
  pause duration automatically.
2026-05-18 — Palette navigation blocked entirely while paused rather
  than auto-resuming; student must explicitly resume before
  navigating to preserve timing integrity.
2026-05-18 — Last question save button labelled "Save" only; no
  terminal submit button at question level; student uses main Submit
  button to end attempt; palette colour is sufficient review signal.
2026-05-18 — Save always overwrites review state with answered;
  Mark for Review is a transient flag not a persistent lock; any
  subsequent save clears it unconditionally.
2026-05-18 — Student average duration uses most recent attempt per
  question not mean across attempts; reflects current ability not
  historical average; field hidden entirely when no per-question
  time data exists to avoid showing value identical to estimated.
2026-05-18 — Custom duration stored as both minutes (customDurationMin)
  and resolved seconds (selectedDuration); minutes preserved for
  display, seconds used by CBT timer directly.
2026-05-18 — CBT timer source is paper.meta.selectedDuration set at
  Select tab; no duration recomputation inside CBT initialisation;
  old records without the field fall back to parseDuration for
  backward compatibility.
2026-05-27 — stem_figure and option figure fields were always present
  in the question schema but never read by the app; all rendering paths
  (select, preview, CBT live, CBT result, OMR result) now check for
  these fields and inject <img> elements; no schema change required.
2026-06-01 — Delete in History tab propagates to D1 via POST
  /delete-paper; Worker validates user_email ownership before DELETE
  so users cannot remove each other's records; fire-and-forget matches
  existing save-paper pattern; no changes to sync or merge paths.
2026-06-01 — Title edit sync debounced at 800ms to avoid rapid-fire
  POSTs on every keystroke; entry re-read from localStorage at timeout
  execution time so cloud always receives the final title value;
  paperGenerate() POST removed — new papers only reach D1 after the
  user edits the title, which is the normal flow.
2026-06-01 — CBT tab lock uses a module-level boolean rather than
  inspecting DOM state; flag cleared before result render so the result
  screen itself does not block navigation; duplicate warning suppressed
  by checking for existing .cbt-lock-warning element.
2026-06-01 — One-attempt-per-paper enforced at History render time by
  checking ch_attempts.paperId; Load removed rather than disabled so
  the UI does not suggest re-attempting is possible with a different
  button; Enter Answers disabled and greyed to communicate the state.
2026-06-01 — Hint/Solution accordions use lazy renderMath() on first
  open to avoid unnecessary KaTeX work for questions the user never
  expands; full question object available in cbtViewAttempt() via
  paper lookup so hint/solution fields are accessible without schema
  changes.
2026-06-01 — Hint/Solution accordions added to cbtShowResult() breakdown
  identically to cbtViewAttempt(); q object is directly available in the
  breakdown forEach loop so no additional lookup required.
2026-06-01 — cbtSessionComplete flag separates "result visible" from
  "attempt in progress"; Back to History clears the DOM only — flag
  stays true until cbtRenderAttempt() starts a fresh session; CBT tab
  click shows a neutral idle message rather than calling any render
  function when complete flag is set.
2026-06-01 — Deleting a paper now cascades to its attempt: localStorage
  ch_attempts filtered by paperId on the client, and Worker POST
  /delete-attempt scans the user's D1 rows, parses attempt_json to find
  the matching paperId, and deletes by primary key; always returns
  {ok: true} so a missing attempt is not treated as an error; fire-and-
  forget matches existing delete-paper pattern.
2026-06-01 — Orphaned attempts cleaned on page load via
  cleanOrphanedAttempts(); cross-references ch_attempts against ch_papers
  Set so stale attempts left by earlier bugs or direct localStorage edits
  are removed automatically; batch D1 delete uses a single parameterised
  IN query with user_email ownership check rather than per-row deletes;
  called after syncFromCloud() merges complete in remote mode and after
  filterLoadBooks() in local mode so the paper Set is always up to date
  before the orphan check runs.
2026-06-02 — workerPost template literal uses a hardcoded / separator
  between workerUrl and path; path arguments must have no leading slash
  to avoid double-slash URLs; four call sites corrected (save-paper,
  delete-paper, delete-attempt, delete-attempts-batch); save-attempt
  was already correct.
2026-06-06 — # column in result breakdown uses align-self:start on the
  first grid child rather than a table or per-element style so the fix
  applies to all current and future row heights without touching JS.
2026-06-06 — question_id row rendered before Hint/Solution accordions
  so the ID is always visible without expanding any accordion; muted
  DM Mono 11px style keeps it unobtrusive; placed in both result paths
  (cbtShowResult and cbtViewAttempt); cbtViewAttempt falls back to
  resp.question_id when the full question object is unavailable.

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
