# Phase 14 — server worker report

Contract: `phase-14-asisten-ai.md` §4. Worktree `feat/portfolio-ai-assistant`, nothing committed.

## Done

### Threads (§4.1)

- `packages/db/src/schema/agent.ts`: `agent_threads.portfolio_id` (text, FK `portfolio.id`, on delete set null, indexed). Migration `migrations/20261114073922_confused_doctor_strange/` (reviewed: `ADD COLUMN`, `CREATE INDEX agent_threads_portfolio_id_index`, FK `ON DELETE SET NULL`; nothing else).
- `agent/threads.ts`: `threads.start` takes `portfolioId`; scope `document` needs exactly one of `resumeId` / `coverLetterId` / `portfolioId`, other scopes none. Route description updated.
- `agent/document.ts`: `AssistantDocument.kind` gains `"portfolio"`; `documentOf` reads `thread.portfolioId` first; `requireOwnPortfolio(userId, id)` = `requireEnabled` (the `PORTFOLIO_MODE` gate the portfolio procedures use, `portfolio/access.ts`) + owner check (`NOT_FOUND` otherwise); `loadDocument` for a portfolio only confirms it (never locked, no passages); `PORTFOLIO_DOCUMENT_NAME = "Portfolio"`.
- `agent/service.ts`: start/get/list/describe/send handle portfolio threads; no posting for a portfolio; thread summaries carry `portfolioId` + `portfolioName`.
- `dto/agent.ts`: `agentThreadSchema` + `portfolioId`, `portfolioName`; conversation `document.kind` enum + `"portfolio"`.

### Tools in a portfolio thread (§4.2)

- `agent/portfolio.ts` (new): `createPortfolioRun` = one reply's working copy, loaded lazily once (`portfolioService.aiState`: saved data, source, status, `updatedAt`, unplaced uploads, plan). `read` → `{ name: "Portfolio", updatedAt, data: portfolioAiView(…) }`; `edit` → `applyPortfolioEdits(working, edits, { mode: "strict", plan, images })`, keeps the result as the copy (no DB write), returns `EditPortfolioOutput` cards (new `id`, resolved `edit`, `summary`, `status: "pending"`, `itemId?`, `ref?`), counts `editsProposed`; `saveImage` reads the thread's sent attachment, accepts `image/png|jpeg|webp`, stores it through `portfolioService.addImage` (same checks/records as `uploadImage`) and adds it to the copy's known images. `editPortfolioModelOutput` (compact: summaries, new ids/refs, failures) and `withCompactPortfolioEdits` (history: also what the user did — applied / undone / not applied yet).
- `agent/tools.ts`: portfolio threads get `read_portfolio`, `edit_portfolio` (with `toModelOutput` → compact JSON; checked against AI SDK 7.0.155 `tool({ toModelOutput: ({ toolCallId, input, output }) => ToolResultOutput })`), `save_attachment_image`, plus `read_profile`, `ask_user_question`, `read_attachment`, `read_page` / `search_web` under the same rules as the document assistant (web tools off on Rezumi AI). No `propose_edits`. `buildPortfolioAgentInstructions({ shared, searchTool, canReadPage })` = `portfolio-assistant-system.md` + the shared web paragraph (`webInstructions`, now also used by `buildAgentInstructions`) + `PORTFOLIO_EDIT_GUIDE` appended. Anthropic cache-control path unchanged (one stable string).
- `agent/service.ts`: in portfolio threads every attachment reference in user messages reaches the model as `(Attached <filename>, <mediaType>, attachmentId: <id>.)`, so pictures sent earlier can still be saved; earlier `tool-edit_portfolio` results replay compact. `readAttachmentFile` (thread + user + already sent), `countProposedEdits` (shared with `propose_edits`).
- `agent/context.ts`: `read_portfolio` joins `SNAPSHOT_TOOL_NAMES`.
- `agent/messages-persistence.ts`: `tool-edit_portfolio` parts count as edits (`proposedEditsOf`, `withEditStatuses`, stored statuses kept while a run rewrites its draft).
- Prompt `packages/ai/src/prompts/portfolio-assistant-system.md` (rules of §4.2), exported as `portfolioAssistantSystemPromptTemplate` from `@rezumi/ai/prompts`.
- `agent-tool-contracts.ts`: `portfolioEditCardSchema` gains optional `itemId` and `ref` (additive).

### Portfolio service and router (§4.3)

- `portfolio/edits.ts` (new): `portfolioEditPlan(userId, client)` → `null` unless `isBillingAppliedTo`, else `{ maxWorks, features: { premiumPortfolioThemes, premiumHeroEffects, hidePortfolioCredit }, name: "Free" | "Plus" | "Pro AI" }`; `unplacedUploads(userId, client)` → the account's image `portfolio_file` rows not used by saved data and not overdue (newest 40), each with its `-sm` thumb.
- `portfolio/service.ts`: `aiState` (above), `aiView(userId)` → `{ view, updatedAt, published, url, uploads, plan }`, `applyEdits(userId, { title?, edits, expectedUpdatedAt? })` → one transaction under `lockPortfolio`; stale `expectedUpdatedAt` → `PORTFOLIO_VERSION_CONFLICT`; strict engine with plan + unplaced uploads; nothing applied → nothing written; else `prepareData` + `saveVersionedData` (plan check + file usage). Returns `{ title, applied: [{ index, summary, id?, ref? }], failed, updatedAt }`.
- `portfolio/media.ts`: `addImage(userId, { source: { url } | { file }, alt? }, signal?)` — URL through `fetchRemoteImage` (`remote.ts`: public addresses only, redirects re-checked, deadline, 10 MB cap); then the `uploadImage` checks (≤ 2.5 MB, ≤ 2000 px, still JPEG/PNG/WebP by bytes), `recordUploads` (plan quota, account ceiling and file cap, `portfolio_file` row) and `storeRecordedFiles`. No thumbnail. Returns `{ key, width, height, alt }`.
- `portfolio/errors.ts`: `pictureNotResized(…)` — same codes (`PORTFOLIO_FILE_TOO_LARGE`, `PORTFOLIO_IMAGE_INVALID` reason `dimensions`) with messages saying the server can't make pictures smaller and what to send.
- `portfolio/router.ts` (all `tags: ["Internal"]`, `protectedProcedure`, rate limit before input): `aiView` (GET `/portfolio/ai-view`), `applyEdits` (POST `/portfolio/edits`, `portfolioUpdateRateLimit`), `addImage` (POST `/portfolio/files/images/add`; a `url` uses `portfolioRemoteImageRateLimit`, a file `portfolioUploadRateLimit`; file ≤ 10 MB at the router so the service gives the clear size message). No new rate-limit keys were needed (`packages/utils/src/rate-limit.ts` untouched).

### MCP (§4.4)

- Tool names (`mcp-tool-names.ts`): `get_portfolio`, `create_portfolio`, `edit_portfolio`, `add_portfolio_image`, `publish_portfolio`, `get_portfolio_statistics`; metadata in `tool-meta.ts` (plain zod, no transforms), handlers in `tools.ts`.
  - `get_portfolio` (read): `portfolio.status` then `portfolio.aiView` → `{ exists, enabled, updatedAt, published, url, view, guide, message }`; no portfolio → `exists: false` + "create one with `create_portfolio`".
  - `create_portfolio` (write): `{ sourceResumeId?, theme? }` → `{ id, updatedAt, sourceResumeId, message }`.
  - `edit_portfolio` (write, destructive): `{ title, edits, expectedUpdatedAt? }` → `portfolio.applyEdits`; failures are in the successful result (`failed[]` + text lines).
  - `add_portfolio_image` (write, open world): exactly one of `url` / `file` (`fileInputSchema`), `alt?` → `{ image, message }`.
  - `publish_portfolio` (write, destructive, open world): `{ published }` → `setPublic` → `{ published, url, message }`.
  - `get_portfolio_statistics` (read): `{ range?: 7 | 30 | 90 }` → `{ statistics }` (described loosely in discovery; the procedure's full schema stays in the API).
- Prompts `build_portfolio`, `improve_portfolio` (no arguments; `PROMPT_ARGUMENTS` feeds the server card); resources `portfolio://current` and `portfolio://_meta/edits` (+ server card rows). Server card description now names cover letters, applications and the portfolio.
- `results.ts`: `withErrorHandling(label, handler, domain?)` / `safeMcpError(…, domain?)`; portfolio hints by code (`PORTFOLIO_DISABLED`, `PORTFOLIO_EXISTS`, `PORTFOLIO_EMAIL_NOT_VERIFIED`, `PORTFOLIO_VERSION_CONFLICT` → call `get_portfolio` again, `PORTFOLIO_SUSPENDED`, image size/type, link unreadable, storage full, source invalid) and, only in the portfolio domain, `NOT_FOUND` → `create_portfolio`. `PLAN_LIMIT_REACHED` / `PLAN_FEATURE_REQUIRED` now hint "the plan doesn't allow this" for every tool (was the generic "Permission denied"). Pinned generic hints unchanged.
- `apps/server/src/mcp/server.ts` instructions mention the portfolio tools and resource. `agent.threads.start` parity description mentions `portfolioId`.
- `.agents/docs/mcp-tool-annotations.md`: six rows (+ evidence bullet).

### Other

- `docs/spec.json` regenerated (`pnpm --filter server docs:gen`): only the Agent thread changes (portfolio routes are Internal).
- `packages/mcp/package.json` depends on `@rezumi/portfolio` (for `PORTFOLIO_EDIT_GUIDE`); `pnpm-lock.yaml` gained exactly that 3-line importer entry (an unrelated tailwind catalog line pnpm 12.16 rewrote was reverted; `pnpm install --frozen-lockfile` passes).

## Tests run

All after the engine landed (`packages/portfolio/src/edits/index.ts` no longer has the stub marker), real engine.

- `pnpm --filter @rezumi/db typecheck`, `@rezumi/api`, `@rezumi/ai`, `@rezumi/mcp`, `server`: clean. Also `web` and `mobile` typecheck: clean (consumers of the DTO).
- `PORTFOLIO_TEST_DATABASE_URL=…/rezumi_portfolio_ai_test COVER_LETTER_TEST_DATABASE_URL=…/rezumi_portfolio_ai_test pnpm --filter @rezumi/api test`: 114 files passed, 10 skipped; 1323 tests passed, 134 skipped. (Own database `rezumi_portfolio_ai_test`; the suites migrate isolated schemas themselves, including the new migration.)
  - New/extended: `agent/portfolio.test.ts` (working copy across read → edit → read, one load, card ids + `pending`, failures, unknown image keys, saved attachments placeable, type refusal, compact output and history statuses), `agent/tools.test.ts` (portfolio tool set, `toModelOutput`, instructions + guide), `agent/context.test.ts` (`read_portfolio` pruning), `agent/messages-persistence.test.ts` (`edit_portfolio` statuses/counting/kept while streaming), `agent/service.test.ts` (portfolio start: owner + mode checks, insert shape, summary; get: document + read-only when gone/disabled; send: tool set, instructions, no posting, attachment ids, one working copy, `editsProposed`, attachment rules), `agent/threads.test.ts` (start input: exactly one document), `portfolio/router.test.ts` (new procedures refused while off; input checks), `portfolio/ai-edits.integration.test.ts` (real DB: applied + failed, nothing applied → no write, version conflict, plan refusals incl. works limit, placing an upload marks file usage and leaves the uploads list, foreign keys refused, mode/ownership, `aiView` plan/url/uploads, `addImage` from file and mocked URL fetch, too large / too wide / not a picture / link unreadable, plan storage quota).
- `pnpm --filter @rezumi/mcp test`: 6 files, 35 tests (incl. discovery parity, annotations doc, server card, new `portfolio-context.test.ts`, handler round trips for `get_portfolio` / `edit_portfolio` / `add_portfolio_image` / `publish_portfolio`, portfolio error hints).
- `pnpm --filter server test src/mcp`: 9 passed. `pnpm --filter @rezumi/ai test`: 8 passed. `pnpm --filter dsh-plugin-rezumi test`: 6 passed.
- `pnpm exec turbo boundaries`: no issues.
- `vp lint --fix`, `vp fmt`, `vp lint --deny-warnings --format=agent` on every owned path: clean; `vp fmt --check` on them: clean.

## Cross-area

For **web**:

- `agent.threads.start({ portfolioId, aiSource?, aiProviderId? })` (scope defaults to `document`). Errors: `PORTFOLIO_DISABLED` (403) while portfolios aren't open to the account, `NOT_FOUND` for another account's or a missing portfolio.
- Thread summary (`agentThreadSchema`): `portfolioId: string | null`, `portfolioName: string | null` (`"Portfolio"` when `portfolioId` is set; show your own translated word). `threads.get().document` = `{ kind: "portfolio", id, name: "Portfolio", locked: false }`, or `null` + `isReadOnly: true` when the portfolio is gone or portfolios are off.
- `messages.send` unchanged. `context.document: false` withholds the portfolio (the assistant is told it can't read or edit it); `context.posting` is ignored for portfolios. Attachments: send image attachments as today (`attachmentIds`); `save_attachment_image` refuses anything but PNG/JPEG/WebP and anything over 2.5 MB or 2000 px (the error says the server can't resize), so compress first as §5 says.
- Tool parts: `tool-read_portfolio` output `{ name: "Portfolio", updatedAt, data }`; `tool-edit_portfolio` input `{ title, edits }`, output `EditPortfolioOutput` = `{ title, edits: [{ id, edit, summary, status: "pending", itemId?, ref? }], failed: [{ index, error }] }` (cards carry the resolved edit for replay; `itemId` is the id an `add` created); `tool-save_attachment_image` output `{ image: { key, width, height, alt, thumbKey? } }`. A failed tool call is an `output-error` part with `errorText`.
- `agent.messages.setEditStatus({ threadId, messageId, toolCallId, edits: [{ id: <card id>, status }] })` works for `tool-edit_portfolio` exactly like `propose_edits`; accepted cards count in `editsAccepted`, applied cards were counted in `editsProposed` when made. Statuses set while a reply still streams are kept.
- In later turns the model sees each earlier card as applied / undone by the user / not applied yet, from those statuses, so record accepted and rejected.

For the **principal**:

- Migration `migrations/20261114073922_confused_doctor_strange` (apply before deploying). No new env vars.
- `pnpm-lock.yaml`: one importer hunk (`packages/mcp` → `@rezumi/portfolio`).
- Docs to update: `docs/guides/using-the-mcp-server.mdx` (six portfolio tools, `build_portfolio` / `improve_portfolio`, `portfolio://current` / `portfolio://_meta/edits`); the assistant guide for portfolio conversations. `docs/spec.json` already regenerated.
- Annotation call to confirm: `edit_portfolio` is closed-world as the contract table says (it never publishes), while `apply_resume_patch` is marked open-world because a public resume changes for viewers. Flip to `openWorldHint: true` (code + doc row) if you want them consistent.
- The MCP server card description changed (`buildMcpServerInfo`), and PLAN_* errors now get a plan hint in every MCP tool.

## Not done

- Nothing left from §4. The server never resizes pictures (by design): `addImage` refuses oversize ones with a clear message.
- Not exercised: a live model run in the browser and a real MCP client round trip (principal's §6 checks).

## Round 2 (security review fixes)

### Done

1. **M2: picture metadata stripped in `addImage`.** New pure module `packages/api/src/features/portfolio/image-metadata.ts` (`stripPictureMetadata`), byte-level, no re-encoding:
   - JPEG: keeps APP0 JFIF, APP2 `ICC_PROFILE`, APP14 Adobe and every table, frame and scan. Drops APP1 (EXIF/XMP), APP13 (IPTC), COM, every other APPn (maker data, MPF, JFXX) and anything after EOI (appended pictures, motion clips). Progressive scans are kept.
   - Orientation: an EXIF orientation of 2–8 is kept as a minimal APP1 holding only that tag, because browsers draw the photo turned by it. For orientations 5–8 `addImage` records width and height swapped, as the page shows them.
   - PNG: drops `tEXt`, `zTXt`, `iTXt`, `eXIf`, `tIME`, and anything after IEND.
   - WebP: drops `EXIF` and `XMP ` chunks, clears the VP8X EXIF and XMP flags, and rewrites the RIFF size.
   - Malformed input (lengths past the end, the wrong format) returns null, which `addImage` refuses as `PORTFOLIO_IMAGE_INVALID` (`unreadable`). The stripped bytes are checked again with `readPortfolioImageHeader`.
   - Covers MCP `add_portfolio_image`, `portfolio.addImage` and `save_attachment_image`, which all go through `addImage`. The editor's `uploadImage` is unchanged: the browser re-encodes those pictures.
2. **M3: raw-size guard on `applyEdits`.** `rejectOversizedData(input, "edits")` runs before `.input`, with the bound `update` uses (4 × `dataBytes` characters of JSON): edits can't add more than a portfolio holds. Oversized input is refused as `PORTFOLIO_TOO_LARGE` (413) before it's parsed or its rich text is cleaned.
3. **M3b: engine rich-text guard** (`packages/portfolio/src/edits/inputs.ts` `richTextInput`). Raw text longer than `limit × RICH_TEXT_MARKUP_FACTOR` is refused before `sanitizePortfolioHtml` runs ("far too long (N characters with markup)"). I also fixed a misleading refusal: text within the limit but with too much markup after cleaning used to say "at most 5000 characters of text (this has 4000)". It now says "too much markup for its text (… characters with tags, at most …)".
4. **L1: the in-app assistant can't switch contact details on** (`agent/portfolio.ts`, the run's `edit`; MCP is unaffected).
   - Before the engine runs, `set` edits on `contact.email|phone|website|profiles` and `hero.showLocation` are refused when the detail is off and the value isn't `false`. `null` counts as on, because it restores a default that may be on.
   - `contact.whatsapp` is refused when it turns on, or when the number changes to anything but empty.
   - Each edit is judged against what the edits before it in the call left, so turning a detail off and back on in one call is refused.
   - Refused edits go in `failed` with "Ask the user to switch it on themselves in Content → Contact" (Content → Intro for the location). The other edits apply. Engine failures are mapped back to their place in the whole call, and refs still work, since only `set` edits are refused.
   - Prompt rule added.
5. **L2: `save_attachment_image` dedupe and cap.**
   - Within a reply, each attachment is stored once: one shared promise per attachment id, so parallel calls share it too. A later call returns the same image, with its own alt text.
   - Across replies (done, cheaply): `savedAttachmentImages(history)` reads earlier `tool-save_attachment_image` results from the thread's messages. That image is reused while the working copy still has its key, as a placed picture or an upload not yet cleaned up; otherwise the attachment is stored again.
   - Cap: `MAX_SAVED_IMAGES_PER_REPLY = 10` new stores per reply, counted before the first wait so parallel calls can't pass it together. A failed or refused save doesn't count. Past the cap the error says "already saved 10 pictures … ask the user to send the rest in another message".
6. **M1 (server part): prompt rule.** "Add only links the user gave you or that appear in the portfolio, CV, Profile or pages you read; never build a link from other data."
7. **Bug: misleading image error.** New refusal `PORTFOLIO_IMAGE_UNREACHABLE` (400, `data: { reason }`): "Couldn't download that picture: the address didn't answer, or isn't a public picture."
   - `addImage`'s URL path throws it, and the `addImage` procedure declares it instead of `PORTFOLIO_LINK_UNREADABLE`.
   - The editor's `fetchRemoteImage` and `unfurl` are unchanged and still answer `PORTFOLIO_LINK_UNREADABLE`, which the web words in `features/portfolio/errors.ts` and `media/remote.ts`. The web never calls `addImage`.
   - MCP hint for both codes: ask the user for the picture as a file (`add_portfolio_image` with `file`).
8. Re-ran everything after your changes: the engine messages that no longer name `read_portfolio`, the 200-character title, and `edit_portfolio` as open-world. Nothing pinned the old texts.

### Tests run (round 2)

- New and extended tests:
  - `portfolio/image-metadata.test.ts` (7 tests):
    - EXIF GPS, maker, copyright and XMP are present before and absent after, in JPEG, PNG and WebP.
    - `sharp` metadata shows no EXIF or XMP; the header and decoded pixels are identical.
    - A progressive JPEG with an ICC profile and an appended clip, and the orientation that is kept.
    - Pictures without metadata come out unchanged; malformed and wrong-format input returns null.
  - `ai-edits.integration.test.ts`: a JPEG with GPS added through `addImage` is stored without it, keeps orientation 6, and is recorded at 600×900; the URL failure now gives `PORTFOLIO_IMAGE_UNREACHABLE`.
  - `agent/portfolio.test.ts`:
    - The privacy guard: every guarded path, null, off then on in one call, the WhatsApp number, and indices around refused edits.
    - Save dedupe (parallel and repeated), the cap, refused saves not counting, reuse across replies (kept versus cleaned up), and `savedAttachmentImages`.
  - `router.test.ts`: `applyEdits` with 10 × 1 MB edits gives `PORTFOLIO_TOO_LARGE`.
  - `errors.test.ts`: the new code.
  - `apply.test.ts` (engine): the raw-length refusal comes fast, and the markup message.
  - `tools.test.ts` (MCP): the new hint.
- Suite results:
  - `PORTFOLIO_TEST_DATABASE_URL=…/rezumi_portfolio_ai_test pnpm --filter @rezumi/api test src/features/agent src/features/portfolio`: 34 files, 470 tests passed.
  - `pnpm --filter @rezumi/mcp test`: 36 passed.
  - `pnpm --filter server test src/mcp`: 9 passed.
  - `pnpm --filter @rezumi/portfolio test src/edits`: 75 passed.
  - `pnpm --filter @rezumi/ai test`: 8 passed.
- Typecheck is clean for api, ai, mcp, portfolio, server and web.
- `vp lint --fix`, `vp fmt` and `vp lint --deny-warnings --format=agent` are clean on every touched path; `vp fmt --check` is clean.

### Cross-area (round 2)

- New refusal code `PORTFOLIO_IMAGE_UNREACHABLE`. It's only thrown by `portfolio.addImage`, which the web doesn't call; add wording in `apps/web/src/features/portfolio/errors.ts` if it ever does.
- Pictures added through `addImage` with EXIF orientation 5–8 are recorded with width and height swapped, matching how browsers draw them.
- Docs (principal): the assistant guide could say the assistant can't switch contact details on, and that pictures added through MCP or the assistant lose their metadata.
