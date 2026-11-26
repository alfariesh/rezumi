# Store smoke flows

Run later on an installed development/preview build, **phone portrait**, English app/browser/OS UI, against an isolated HTTPS test server with a disposable account. These flows change private resume notes. Never use personal resumes, production credentials or production data. No emulator, simulator or native build is started by these files.

Maestro is not installed on the M8-T2 host. YAML parsing passed; `maestro check-syntax` and all device runs remain for the coordinator:

```sh
for flow in apps/mobile/e2e/*.yaml; do maestro check-syntax "$flow"; done
```

Supply `SERVER_ORIGIN`, `EMAIL` and `PASSWORD` through the runner environment for `sign-in.yaml`. Start signed out, with browser cookies cleared for the test server, email sign-in enabled and no 2FA. The flow selects Another server, discovers it, signs in through the system browser, accepts OAuth consent when shown, and waits for Documents. Do not store credentials in YAML or commit runner output: input steps and screenshots may expose test credentials.

For each remaining flow, supply `RESUME_ID` for an **unlocked disposable resume** belonging to that signed-in account. Start with empty notes for edit-and-save; use a different disposable resume for offline-and-reconnect. Existing Notes editor exercises the shared draft owner; Write is now implemented after the native-app merge. Flow opens Share → Document options → Notes, modifies the draft, dismisses the phone sheet, checks Saved (or Offline then Saved), and reopens notes after restarting the app. Rich-text accessibility selection and the sheet swipe need device verification; this is authored coverage, not a passing device claim. Saved confirms server acknowledgement in the current draft implementation; restarting alone is insufficient because local drafts persist.

- `edit-and-save.yaml`: online note save and restart/readback, both platforms.
- `offline-and-reconnect.yaml`: **Android**; Maestro `setAirplaneMode`, offline edit, reconnect, server acknowledgement, restart/readback. `onFlowComplete` turns airplane mode off even after failure. Verify Wi-Fi is also disabled while airplane mode is on. If interrupted externally, restore connectivity manually. For iOS, coordinator repeats the scenario with connectivity controlled outside Maestro; do not treat Android YAML as an iOS pass.
- `export.yaml`: both platforms; Download PDF → actual OS share sheet. Supply `SHARE_SHEET_TEXT` for the visible OS share-sheet control (for example `Save to Files` on English iOS, or the tested Android share target). It asserts the share UI, not the contents or saving of the PDF. Coordinator should save/open the exported PDF and verify pages manually.

Example for a non-secret parameter:

```sh
maestro test -e RESUME_ID="$RESUME_ID" -e SHARE_SHEET_TEXT="Save to Files" apps/mobile/e2e/export.yaml
```

OS browser-consent text, native rich-text accessibility and sheet gestures may need selector adjustments after the first device run. No app-only test flags, authentication bypasses or production test seams were added.

`jobs.yaml` (Phase 09): search → open the first listing → Track → it shows in Applications. Point the server's job search at the local treg stub (`TREG_BASE_URL=http://127.0.0.1:3999`, `TREG_API_KEY` any value; launch config `treg-stub-09` + `rezumi-mobile-09`), never at treg, and supply a role the account hasn't tracked: `maestro test -e QUERY="Data analyst" apps/mobile/e2e/jobs.yaml`. Passed on the iPhone 17 simulator (iOS 27.2) on 2026-11-22.

## Coach and editor assistant

Use a signed-in, disposable account with a tested OpenAI-compatible connection pointed at the local stub from the web tests. Run this from the repository root and leave it running while exercising the flows.

```sh
pnpm --filter server exec tsx -e 'import { startAiStub } from "../../tests/e2e/fixtures/ai-stub.ts"; void startAiStub(39411)'
```

Start a local Rezumi server with `FLAG_ALLOW_UNSAFE_AI_BASE_URL=true` and an encryption secret. Add a connection with base URL `http://127.0.0.1:39411/v1` as seen by the **server**, model `stub`, and a fictional key. Test the connection and make it the default. Create an unlocked sample resume on this account so the stub has a passage to edit. Use an English app UI and a phone in portrait.

```sh
maestro test apps/mobile/e2e/coach.yaml
maestro test -e RESUME_ID="$RESUME_ID" apps/mobile/e2e/assistant-proposals.yaml
```

## Portfolio editor

Use English UI and an unpublished portfolio on an isolated, disposable account. For the editor flow, put a fictional picture in the device gallery and supply its visible picker label as `PHOTO_LABEL`. Verify camera denial and gallery cancellation separately. For the rewrite flow, configure an AI stub that returns a deterministic shorter greeting and supply the consent action's label as `AI_CONSENT_BUTTON`.

- `portfolio-editor.yaml` adds a work, cover, text and metric, then previews and publishes.
- `portfolio-design.yaml` changes a Lugas portfolio to Prima and replays the intro in Preview.
- `portfolio-rewrite.yaml` rewrites the greeting and undoes the edit.

The flows require device verification. Check phone and tablet layouts, Indonesian and English, and dark and light mode in the device pass.
