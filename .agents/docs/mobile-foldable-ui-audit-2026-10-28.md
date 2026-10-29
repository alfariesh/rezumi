# Native UI audit — 28 October 2026

Tested and repaired the React Native app on T3 Code's Pixel 10 Pro Fold emulator in folded and unfolded postures, with supplementary iPhone testing. The tablet editor now has compact mode pills, space between the title, modes and Download, and a separate centred mode row when enlarged text needs it. Concrete defects found in the exercised workflows were fixed and retested. This is simulator and local-source evidence, not a claim that every device, integration or rendering combination is perfect.

## Environment and evidence

| Target                        | Coverage                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pixel 10 Pro Fold, Android 17 | Folded 1080 × 2364 px, approximately 443 dp wide; unfolded 2076 × 2152 px, approximately 852 dp wide; density 2.4375                |
| Postures                      | Closed/open transitions during editing and sheets; half-open and landscape inspected during the audit                               |
| Android typography/appearance | Font scales 1.0, 1.35 and 2.0; light/dark; selected German, Portuguese and Polish layouts                                           |
| iPhone 18 Pro, iOS 27         | 402 pt viewport; real software keyboard; default and accessibility text, including scale 3.12                                       |
| App                           | Development native builds running the current local Metro source; production Hermes bundles exported separately for Android and iOS |
| Backend/data                  | Local backend on port 18400, disposable database `rr_fold_ui_20261028`, fictional documents and career/application data             |

Screenshots, measured node trees, assertions, exports and check logs are in `/tmp/rr-fold-ui-20261028/`. `ledger.json` indexes results. These local artifacts are outside Git and are temporary. `01-folded-sign-in.png` shows the browser login page, not the native sign-in landing; native landing evidence is in 41/42 and the iOS captures.

Nine focused design reviews used Claude Opus 5.5 with Extra High effort through T3 Code Orchestrator V2. Reviews covered onboarding, editor/navigation, applications and responsive layouts, keyboard behavior, and final alignment. The ninth review confirmed the requested header spacing and toolbar alignment, and identified the final letter-card, Share inset and row accessibility refinements. The subsequent iPhone accessibility-text check caught and verified the company/stage wrapping refinement.

## Repairs

- **Authentication:** bounded the server form and footer to the existing panel width, made the sticky footer opaque, removed extra keyboard spacing, stacked footer actions at large text, and retained the configured host when changing servers.
- **Editor chrome:** removed Android's duplicate top inset in nested tablet headers; gave Saving/Saved a stable glyph box; removed the preview's extra bottom inset while the keyboard is visible.
- **Tablet/phablet header:** mode pills use their intrinsic width, with horizontal breathing room and a centred second row at large text. Download aligns vertically with Assistant and the title/status block. Phone navigation retains its compact layout.
- **Rich text:** put borders and focus rings on native wrapper views for resume, letter and note inputs; pinned Improve and enabled it on first focus of a nonempty line; kept Underline and Strikethrough available through Text style. Focused tools clear the gesture area with the software keyboard hidden, and align with the preview zoom bar.
- **Keyboard/scrolling:** shared `KeyboardFrame` and `useKeyboardScrollSpace` prevent duplicate keyboard padding inside resized viewports while preserving focus scrolling. Letter body focus scrolls into view. Actual animated keyboard height now drives visibility, fixing missing bottom navigation after Android text-size changes recreate the activity with stale keyboard-event caches.
- **Responsive content:** bounded application detail and Knowledge content; retained the full-width Facts list viewport for refresh gestures; grouped application Stage controls and omitted an empty What you sent card. The linked-application card in the letter editor reflows role, company, stage and Change at accessibility sizes.
- **Navigation/accessibility:** improved long/localized bottom-navigation labels, stacked appearance choices at large text, preserved library search across remounts, removed a forced grid remount, and removed duplicate calendar weekday announcements. Passive rows use a View so native switches remain reachable; informational rows retain grouped announcements. Full screen-reader traversal remains unverified.
- **Sharing/exports:** replaced an unregistered Share icon that crashed the screen, grouped Public link consistently with other settings, and encoded letter-export localization parameters using bracketed query keys, fixing non-PDF export requests that returned 400.
- **Application history:** metadata and bulk tag edits no longer mark newly linked draft documents as submitted. Explicit stage/link actions still record submission snapshots. This shared API fix benefits both web and native consumers.

No native dependencies, native source, permissions or app configuration were changed. No release, OTA publication, store submission, commit or push was performed.

## Executed workflows

“Passed” below describes the stated checks, not exhaustive coverage of the whole feature.

| Area             | Result and evidence                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication   | Native browser sign-in, cancellation, retry, consent and local token return passed. Invalid/mismatched issuers were rejected. Final native server footer checked with keyboards/default and large text on Android/iOS (66–69).                                                                                                                            |
| Resume editing   | Created a resume; edited basics, summary formatting, experience dates/present state, template, accent and font; confirmed persistence through API assertions and cold restart. Native selected-word underline/strikethrough persisted as HTML (`selected-format.json`).                                                                                   |
| Fold continuity  | Drafts and current routes retained across closed/open changes in basics, summary, private notes, application/interview forms, letter body and workspace answer. Password sheet retained both masked fields and focus. Letter application selection sheet retained its selected application through a fold.                                                |
| Offline recovery | Stopped the owned backend, edited and folded, cold-restarted before recovery, observed the local draft, resumed backend and verified retry synchronization (`offline-regression.json`, 43/44). This tests backend outage, not OS airplane mode.                                                                                                           |
| Save feedback    | Measured identical title and status origins in Saving/Saved states; only status text width changed (45/46 and `offline-regression.json`).                                                                                                                                                                                                                 |
| History          | Saved named checkpoints, selected preview, restored a checkpoint and compared the complete ResumeData object (`history-restore-result.json`).                                                                                                                                                                                                             |
| Applications     | Created fictional applications, moved stage, linked resume/letter, checked submitted snapshots, edited notes, and saved a note draft after folding. An application without linked documents shows preparation actions without an empty sent card (62). Metadata/tag edits and explicit submission were checked separately (`submission-regression.json`). |
| Calendar         | Previous/next month and This month worked; the selected interview agenda showed the expected Berlin time for the stored UTC event (25).                                                                                                                                                                                                                   |
| Cover letters    | Created from an application, retained linked sender/design, typed/formatted body with live preview, and verified export share sheets. Final linked-application readability checked at Android 2.0 and iOS 3.12 text scales (82–84).                                                                                                                       |
| Career/workspace | Saved fact, story and salary/remote/notice preferences; rejected invalid salary; retained an Apply answer and emoji input across folds; retained selected Messages tab across posture changes. Facts refresh triggered from outside the bounded content column while the backend was paused, then recovered (75/76).                                      |
| Check/AI setup   | Local resume check reported 22/22; Job match and Writing review opened. Coach/Prepare/Writing review setup guards and Connect form were exercised; blank API key kept Save disabled. No live AI generation was run.                                                                                                                                       |
| Sharing/privacy  | Share opened without a crash. Publishing, QR sheet, password sheet and hide-contact controls worked. Protected public page returned 401 without resume content; hidden-contact page omitted email/phone. Original private/no-password/contact-visible settings restored; public endpoint then returned 404 (`share-privacy-validation.json`).             |
| Library          | Search remained visible and clearable after remount. A 24-resume stress fixture retained the same visible items through folding/unfolding (`anchor-validation.json`). Both measured postures used two columns; this is not proof of a column-count transition.                                                                                            |
| iPhone keyboard  | Summary formatting/Improve/Done and return to bottom navigation passed with the real keyboard; profile and letter focus scrolling checked (34/35, 50, 74).                                                                                                                                                                                                |

The 24 extra stress resumes and the JSON re-import were moved to Trash using their owned fixture IDs. The active library returned to four fictional documents. No production data was used or deleted.

## Export evidence

All five native iPhone resume exports were recovered from the simulator and inspected. Expected fictional name and employer were present in every format. ZIP containers passed integrity checks, JSON parsed, and the PDF was one page with extractable text.

| Native iPhone file |  Bytes | Inspection                                              |
| ------------------ | -----: | ------------------------------------------------------- |
| PDF                | 27,847 | One page; `pdfinfo` and `pdftotext`                     |
| DOCX               | 10,557 | ZIP integrity and `word/document.xml`                   |
| JSON               |  6,016 | Parse; full ResumeData equality after OpenAPI re-import |
| ODT                |  3,025 | ZIP integrity and `content.xml`                         |
| Markdown           |    469 | Expected text                                           |

Android reached native share sheets for all five cover-letter formats and resume export/print surfaces; PDF preview survived unfolding. Authenticated local API exports for DOCX, ODT, Markdown and JSON returned 200 with expected content for both resume and letter. `export-validation.json` records the distinct native-file and API proofs. The JSON roundtrip used OpenAPI, not the native document picker (`json-roundtrip.json`).

## Source validation

| Check                                                                            | Result                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter mobile test`                                                      | 19 passed; 0 failed, skipped or cancelled                    |
| `pnpm --filter mobile typecheck`                                                 | Passed                                                       |
| Application service focused tests                                                | 31 passed                                                    |
| API typecheck and server production build                                        | Passed during the API repair; API source unchanged afterward |
| `pnpm lint:agent`                                                                | Passed on final tree                                         |
| `pnpm format:check`                                                              | Passed on final tree                                         |
| `pnpm exec turbo boundaries`                                                     | Passed                                                       |
| `git diff --check`                                                               | Passed                                                       |
| `EXPO_MOBILE_WEB_PREVIEW=0 pnpm --filter mobile exec expo export --platform all` | Android and iOS production Hermes bundles exported           |

Meaningful regressions execute shipped components/client behavior: native inset/keyboard geometry, first-focus Improve and formatting actions, letter-export query encoding, stale keyboard-cache navigation, row accessibility semantics, and literal icon registration. Intended assertions were observed failing before their corresponding fixes. Device measurements supplement these boundary fixtures; they do not turn them into native end-to-end tests.

Representative final captures: 48/51/59/80 for editor header spacing, 66–69 for auth footer, 70 for navigation after activity recreation, 72 for aligned letter/preview bars, 74 for iPhone keyboard, 75/76 for Facts width/refresh, 78 for iPhone Share, and 82–84 for final large-text letter readability.

## Not verified

- Physical foldables, iPad, ordinary Android hardware/AVD, physical keyboard or hinge occlusion, haptics, and measured frame rate/performance.
- Full TalkBack/VoiceOver traversal. Native accessibility snapshots confirm control labels/states and the passive-row repair; iOS exposes some duplicate internal SwiftUI switch nodes.
- Live AI, voice, search-provider and offer generation, or production identity-provider accounts.
- OS airplane-mode/network switching and native document-picker import roundtrip.
- Every template/font, multipage/non-Latin export, RTL locale, or viewer application's rendering of DOCX/ODT.
- Signed release binaries, hosted CI, production deployment, OTA/runtime-fingerprint compatibility, or store/publication state.

Expo's floating development-menu gear appears in some screenshots and can overlap top-right chrome. It is development tooling, not a production UI element. Source checks and production bundling do not substitute for the unverified gates above.
