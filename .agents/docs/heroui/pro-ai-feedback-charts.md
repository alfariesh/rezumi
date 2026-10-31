# HeroUI Pro v3 (React): AI, Feedback, Charts. API reference + Rezumi fit

Scope: `@heroui-pro/react` AI (14), Feedback (5), Charts (8) components, for migrating `apps/web` off shadcn/Base UI (`packages/ui/src/components`).

Sources and tags:

- `[docs]` = heroui.pro docs via the `heroui-pro` MCP (`get_component_docs`). Only documented props/parts are listed unless tagged otherwise.
- `[d.ts]` / `[impl]` = installed `apps/web/node_modules/@heroui-pro/react@1.0.0-beta.10` typings or built JS. Used only to confirm or fill gaps the docs leave open; every such item is tagged. Docs are for the latest release, installed is beta.10 (Queue and TokenInput both exist in beta.10).
- "Fit for Rezumi" = read from the current code (files named inline). `[infer]` marks my reasoning, not a doc claim.

Language: Tailwind v4, React 19, compound components with dot notation, `onPress` not `onClick` for HeroUI buttons, no Provider needed.

---

## 0. Package facts and cross-cutting gotchas

Installed: `@heroui-pro/react@1.0.0-beta.10` (workspace catalog), `@heroui/react ^3.2.7`, `@heroui/styles`. CSS already imported in `packages/ui/src/styles/globals.css` (`@import "@heroui/styles"; @import "@heroui-pro/react/css";`). No component from either package is imported anywhere in `apps/web/src` or `packages/ui/src` yet.

Rezumi AI stack: `ai ^7.0.155`, `@ai-sdk/react ^4.0.159` (`useChat` via `apps/web/src/features/assistant/use-assistant-chat.ts`, custom oRPC SSE `ChatTransport` with `reconnectToStream`), `react-markdown ^10.1.0`, `remark-gfm ^4.0.1`, `motion`.

### Import paths

| Import                                                                                                                  | Components                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `@heroui-pro/react` [docs]                                                                                         | ChatConversation, ChatMessage, ChatMessageActions, ChatLoader, ChatSource/ChatSources, ChatAttachment/ChatAttachmentGroup/ChatAttachmentInput, ChatListView, PromptInput (+ `TokenFieldValue`, `usePromptInputTokens`), PromptSuggestion, ChainOfThought, TextShimmer, NumberValue, TrendChip, Rating (+ `RatingStarIcon`), EmojiReactionButton, PressableFeedback, ChartTooltip, `ChatStatus` type |
| `@heroui-pro/react/markdown`                                                                                            | `Markdown`; `StreamMarkdown` (only named in a callout [docs]; typed in [d.ts])                                                                                                                                                                                                                                                                                                                      |
| `@heroui-pro/react/chat-tool`                                                                                           | `ChatTool`, `ChatToolGroup`, `ToolPartState` type                                                                                                                                                                                                                                                                                                                                                   |
| `@heroui-pro/react/code-block`                                                                                          | `CodeBlock`                                                                                                                                                                                                                                                                                                                                                                                         |
| `@heroui-pro/react/area-chart`, `bar-chart`, `line-chart`, `pie-chart`, `radar-chart`, `radial-chart`, `composed-chart` | the charts (subpath-only, need `recharts`)                                                                                                                                                                                                                                                                                                                                                          |

Subpath-only exists to keep optional peers out of the root. The export map also has per-component subpaths for almost everything [d.ts], but docs use root for the rest.

### Optional peers that are not installed in `apps/web` (all currently missing)

- Anything importing `@heroui-pro/react/markdown`: `marked`, `react-markdown` (present), `remark-gfm` (present), `remark-breaks`, `streamdown`, plus `shiki` (Markdown pulls in CodeBlock) [impl: markdown.js statically imports marked, react-markdown, remark-breaks, remark-gfm, streamdown, and CodeBlock which imports shiki]. So "optional" is not optional once you use Markdown: install all of them even if you never use StreamMarkdown.
- `@heroui-pro/react/chat-tool` → `shiki`. `code-block` → `shiki`. Charts → `recharts` (peer `>=2.0.0`; docs link Recharts API pages).
- Not needed by anything in scope: `@number-flow/react` (optional peer; NumberValue does not import it [impl]).

### Cross-cutting gotchas

1. **Presentation only.** Docs repeat "SDK-agnostic / presentation-only". No component calls `useChat`, resumes streams, or persists. Message arrays and status stay in the app (`useAssistantChat`).
2. **`ChatStatus` = `'ready' | 'submitted' | 'streaming' | 'error'`** [docs/d.ts; d.ts comment says aligned with AI SDK]. It equals AI SDK `useChat().status`, so pass it straight to `PromptInput status`.
3. **i18n/Lingui.** Built-in default strings are English and live in the library: `CodeBlock.CopyButton` `aria-label` default `'Copy code'` [docs]; `PromptInput.Queue.Item.Remove`/`More` "include default labels" [docs]; Markdown code header shows the raw language id. Every `aria-label`, `tooltip`, `label`, `triggerPrefix`, `approveLabel`, `rejectLabel`, `ChatLoader label` is a prop: always pass `t` macro output. Audit each used part for default text.
4. **RTL.** Docs examples add `rtl:-scale-x-100` to directional icons themselves. Treat arrows/chevrons you supply as your job. Rezumi uses logical utilities (`ms-`, `inset-s-`, `rtl:`).
5. **`style` prop collision.** `NumberValue` has a `style` prop (formatting style) and omits native `style` from span props [docs]. `Rating` takes `style` for CSS vars (`--rating-active-color`) because it is a normal prop there.
6. **Tool state vocabulary differs from AI SDK.** `ToolPartState` = `input-streaming | input-available | output-available | output-error | requires-action` [docs]. Rezumi reads `approval-requested`, `approval-responded`, `output-denied` (`conversation.tsx` `ToolPartView`). No HeroUI equivalent for the last two; map `approval-requested → requires-action` [infer].
7. **Beta.** `1.0.0-beta.10`. Pin version; docs describe newer surface in places (see per-component notes, e.g. `PromptInput.Queue.Item.Steer` is in [d.ts] but not in docs).
8. **Mobile parity.** All of this is web only. `CLAUDE.md` requires matching `apps/mobile` changes; catalog lists `heroui-native-pro 1.0.0-beta.12` but this note does not cover it.

---

# Part A. AI components

## A1. ChatConversation

Import: `import {ChatConversation} from "@heroui-pro/react"`.
Purpose: scrollable message viewport that stays pinned to the bottom while content streams, leaves the user alone once they scroll up [docs].

Anatomy:

```
ChatConversation                     (div, role="log" [impl])
├─ ChatConversation.Content          (message column; centers/stacks; accepts className like "max-w-[714px] flex-col gap-8 px-4 pb-8 pt-8")
├─ ChatConversation.ScrollButton     (optional jump-to-bottom; appears only when away from bottom)
└─ ChatConversation.ScrollAnchor     (bottom anchor; in anatomy, not used in any demo)
```

Props:

- `ChatConversation`: native `div` props [docs]. Also `initial?: "instant" | "smooth"` (scroll on mount, default `"smooth"`) and `resize?: "instant" | "smooth"` (scroll when content grows while at bottom, default `"smooth"`) [d.ts]; the docs demo only shows `initial="instant"`. `ref` forwards to the scroll element (demo uses it for `scrollTo`).
- `.Content`, `.ScrollAnchor`: native `div` props.
- `.ScrollButton`: extends HeroUI `Button` props plus `aria-label`, `tooltip` (ReactNode) [docs/d.ts]. Implementation renders icon-only, `size="sm" variant="secondary"`, a fixed chevron as `children` that overrides any children you pass [impl: spread then `children`]. Rendered hidden/`aria-hidden` until `hasOverflow && !isAtBottom`.

State/events: uncontrolled. Pin logic uses `ResizeObserver` on Content and a scroll handler; `onScroll` is composed with yours [impl]. No "settle new turn near top" mode, no scroll position restore.

Gotchas:

- Put it in a height-constrained flex parent (`flex h-[520px] flex-col` + `className="flex-1"` in every demo).
- Messages are plain children of Content: no per-item wrapper. No `content-visibility` optimisation.
- `aria-busy`: not set by root; pass to `Content` as a native prop if you want it.

Example:

```tsx
<div className="flex h-full min-h-0 flex-col">
  <ChatConversation className="flex-1" initial="instant" resize="instant">
    <ChatConversation.Content aria-busy={streaming} className="max-w-[714px] flex-col gap-8 px-4 pt-8 pb-8">
      {messages.map((m) => (
        <Row key={m.id} message={m} />
      ))}
    </ChatConversation.Content>
    <ChatConversation.ScrollButton aria-label={t`Latest`} tooltip={t`Latest`} />
  </ChatConversation>
  {/* PromptInput sits outside, shrink-0 */}
</div>
```

Fit for Rezumi (partial; real regression risk):

- Replaces `MessageScroller*` in `packages/ui/src/components/message-scroller.tsx` used by `assistant/conversation.tsx` and `career/coach-chat.tsx`. Both already use `role="log"` + `aria-busy`.
- Lost behaviours: (a) `scrollAnchor={message.role === "user"}` + `defaultScrollPosition="last-anchor"`: a new turn settles near the top and a saved thread reopens on its last user message; HeroUI only pins to the bottom, so a long streaming answer pushes the user's question off screen. (b) `data-pending-scroll:invisible` flash guard. (c) per-row `content-visibility:auto` (`MessageScrollerItem`). (d) "Latest" text button: HeroUI's is icon-only with tooltip.
- Recommendation: keep `MessageScroller` (its behaviour is owned in `packages/ui`, adapted from shadcn's message scroller, not taken from the visual layer) unless the product accepts pin-to-bottom. If adopted, wrap rows that need alignment with your own divs and verify thread reopen UX.

---

## A2. ChatMessage

Import: `import {ChatMessage} from "@heroui-pro/react"`.
Purpose: composable user and assistant turn layouts [docs].

Anatomy:

```
ChatMessage.User
├─ (ChatAttachmentGroup)             optional, above the bubble in the demo
└─ ChatMessage.Bubble
   └─ ChatMessage.Content
ChatMessage.Assistant
├─ ChatMessage.Avatar                alt, fallback, show, src
└─ ChatMessage.Body
   ├─ ChatMessage.Content
   ├─ ChatMessage.Actions            (row) containing ChatMessage.Action (Button)
   └─ ...ChainOfThought / ChatTool / ChatSource(s) / ChatMessageActions
ChatMessage.Media                    (in [d.ts]; not documented)
```

Props [docs unless tagged]:

- `.Assistant`, `.User`: native `div`. `.Body`, `.Bubble`, `.Content`, `.Actions`: native div, no table.
- `.Avatar`: extends HeroUI `Avatar` props [docs]. `[d.ts]`: `alt: string` (required), `fallback?: string`, `src?: string`, `show?: boolean` (default `true`; `false` renders a same-size spacer to keep row alignment in grouped threads).
- `.Action`: extends HeroUI `Button`; `[d.ts]` adds `aria-label`, `tooltip`.

CSS: `.chat-message--assistant`, `.chat-message--user`, `.chat-message__avatar`, `__body`, `__bubble`, `__content`, `__actions`.

Gotchas:

- `.Content` wraps either plain text or `<Markdown>`. Streaming text/loader are siblings in `.Body` (see Loading demo: `TextShimmer` + `ChatLoader.Dots`).
- User turns: `ChatMessage.User` is not given an avatar.
- No `role` prop; you switch on `message.role` yourself.

Example (AI SDK text parts):

```tsx
message.role === "user" ? (
  <ChatMessage.User>
    <ChatMessage.Bubble>
      <ChatMessage.Content>{textOf(message)}</ChatMessage.Content>
    </ChatMessage.Bubble>
  </ChatMessage.User>
) : (
  <ChatMessage.Assistant>
    <ChatMessage.Avatar show alt={t`Assistant`} fallback="AI" />
    <ChatMessage.Body>
      <ChatMessage.Content>
        <Markdown>{textOf(message)}</Markdown>
      </ChatMessage.Content>
    </ChatMessage.Body>
  </ChatMessage.Assistant>
);
```

Fit for Rezumi (adopt, thin):

- Rezumi's `MessageView` (conversation.tsx) / coach-chat `MessageView` hand-roll the same two shapes (`bg-sunken` right-aligned bubble with `ms-8`; assistant `grid gap-3 text-sm`). Maps cleanly onto `User/Bubble/Content` and `Assistant/Body/Content`.
- Rezumi shows no assistant avatar. Either omit `ChatMessage.Avatar` (layout without it is undocumented; verify) or use `show={false}` spacer only if you want an indent.
- Keep the memoised `MessageView` boundary and per-message `ENTER_CLASS`; HeroUI adds no animation of its own.

---

## A3. ChatMessageActions

Import: `import {ChatMessageActions} from "@heroui-pro/react"`.
Purpose: preset icon-button row for copy, rate, regenerate, menu [docs].

Anatomy:

```
ChatMessageActions
├─ .Action                           generic Button (docs API table)
├─ .Copy        └ .CopyIcon         (demo; also CopiedIcon [d.ts])
├─ .ThumbsUp    └ .ThumbsUpIcon
├─ .ThumbsDown  └ .ThumbsDownIcon   [d.ts only]
├─ .Regenerate  └ .RegenerateIcon   [d.ts only]
└─ .Menu        └ .MenuIcon         [d.ts only]
```

Props: root native `div`; `.Action` extends HeroUI `Button` [docs]. Presets accept `aria-label`, `tooltip` (demos). `[d.ts]`: `.Copy` has `isCopied?: boolean`, `copiedIcon?: ReactNode`, `onPress` (from Button); no text/clipboard prop, so you implement copying yourself in `onPress` and flip `isCopied`. Icon subcomponents swap preset icons.

Gotchas: `.Menu` is a button only (no menu content documented); wire `Dropdown` yourself. Each action needs translated `aria-label` and `tooltip`.

Example:

```tsx
<ChatMessageActions>
  <ChatMessageActions.Copy aria-label={t`Copy`} tooltip={t`Copy`} isCopied={copied} onPress={copy} />
  <ChatMessageActions.Regenerate aria-label={t`Regenerate`} tooltip={t`Regenerate`} onPress={() => void regenerate()} />
</ChatMessageActions>
```

Fit for Rezumi (low value now):

- Rezumi has a single "Copy transcript" ghost button per thread, a Retry/Switch-model error card, and a "Stopped / Continue" row. No per-message copy/rate/regenerate. Adopt only if per-message actions become a product feature; `regenerate` semantics already guarded in `retry()` (continuation must resend, not regenerate).

---

## A4. PromptInput (deep)

Import: `import {PromptInput} from "@heroui-pro/react"` (also `TokenFieldValue`, `usePromptInputTokens`; `ChatStatus` type).
Purpose: AI composer: textarea or token field, toolbar, send/stop button driven by `status`, attachments, queue, drag-drop [docs].

Anatomy:

```
PromptInput  (value, onValueChange, onSubmit, onStop, status, layout, size, variant, ...)
├─ PromptInput.Queue                 optional, SIBLING above Shell
│  └─ .Queue.List (values,onReorder) → .Queue.Item (value)
│       ├─ .Item.Handle
│       ├─ .Item.Body → .Item.Icon, .Item.Content (2-line clamp), .Item.Description
│       ├─ .Item.Attachments / .Item.AttachmentsOverflow
│       └─ .Item.Actions → .Item.Remove, .Item.More, .Item.Action
├─ PromptInput.Shell
│  ├─ PromptInput.Content
│  │  ├─ PromptInput.Attachments     (preview row; holds ChatAttachmentGroup)
│  │  └─ PromptInput.TextArea        OR  PromptInput.TokenInput
│  └─ PromptInput.Toolbar
│     ├─ .ToolbarStart → PromptInput.Action (tooltip)
│     └─ .ToolbarEnd   → PromptInput.Send
├─ PromptInput.Tokens / .TokenSuggestions / .Token   (token mode only)
└─ PromptInput.Footer                disclaimer line (renders <p> [d.ts])
```

Root props `PromptInput` [docs]:

| Prop                                                                                                                                            | Type                                                                                                      | Default                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------- |
| `value`                                                                                                                                         | `string`                                                                                                  | internal (uncontrolled) |
| `onValueChange`                                                                                                                                 | `(value: string) => void`                                                                                 | -                       |
| `onSubmit`                                                                                                                                      | `() => void`                                                                                              | -                       |
| `onStop`                                                                                                                                        | `() => void` (called by Send in stoppable states)                                                         | -                       |
| `status`                                                                                                                                        | `'ready' \| 'submitted' \| 'streaming' \| 'error'`                                                        | `'ready'`               |
| `isDisabled`                                                                                                                                    | `boolean`                                                                                                 | `false`                 |
| `lockInputOnRun`                                                                                                                                | `boolean` (disable textarea while submitted/streaming)                                                    | `true`                  |
| `maxHeight`                                                                                                                                     | `number \| string` (also sets `--prompt-input-max-height`, caps token input)                              | `240`                   |
| `size`                                                                                                                                          | `'sm' \| 'md' \| 'lg'`                                                                                    | `'md'`                  |
| `variant`                                                                                                                                       | `'primary' \| 'secondary'`                                                                                | `'primary'`             |
| `layout`                                                                                                                                        | `'stacked' \| 'compact' \| 'inline'` (compact = single-row pill that becomes stacked on wrap/attachments) | `'stacked'`             |
| Also `[d.ts]`: `allowSubmitWhileRunning?: boolean` (mentioned in docs prose for TokenInput, missing from the table) and deprecated `isPending`. |

Sub-part props [docs]:

- `PromptInput.TextArea`: extends HeroUI `TextArea`; `disableAutosize` (default `false`). Enter submits and Shift+Enter newline "matching" the TokenInput statement; Enter ignored while running unless `allowSubmitWhileRunning`.
- `PromptInput.Send`: extends `Button`; icon follows status (send / loading / stop / error). `[d.ts]`: own `status`, `onStop` overrides. Children replace the icon (demo uses `<ArrowUp />`).
- `PromptInput.Action`: extends `Button` + `tooltip`.
- `PromptInput.Queue`: `actionsVisibility: 'always' | 'hover'` (default `'hover'`). `.Queue.List`: `values: T[]`, `onReorder`, `axis: 'x' | 'y'` (default `'y'`); reordering is Motion-based and enabled only when `values` and `onReorder` are both passed. `.Queue.Item`: `value: T` (required when reordering). `.Item.AttachmentsOverflow`: `hiddenCount`, `noun` (default `'files'`). `.Item.Remove/More/Action` extend `Button`. Undocumented `.Item.Steer` exists [d.ts].
- `PromptInput.TokenInput`: replaces TextArea for inline `@mentions`/`/commands`; contenteditable, RAC `TokenField` (alpha RAC API per docs). Props: `tokens` (required, from `usePromptInputTokens`), `children: (segment) => ReactElement` (default `PromptInput.Token`), `placeholder` (default `'What do you want to know?'`), `allowsNewlines` (default `true`), `isReadOnly`, `isDisabled`.
- `PromptInput.Tokens`: wrapper (RAC `Autocomplete`, renders no DOM) around TokenInput + TokenSuggestions only. Anything else menu-like inside it joins the suggestion collection.
- `PromptInput.TokenSuggestions`: RAC `Popover` props minus `triggerRef/getTargetRect`; `tokens` (required), `isOpen` (default `tokens.isOpen`), `placement` (default `'bottom start'`; use `'top start'` for bottom-docked composers).
- `usePromptInputTokens({triggers=['@','/'], allowsSpaces=false, defaultValue, value, onChange})` returns `value, setValue, inputRef, anchor, query, trigger, isOpen, insertToken(text,{appendSpace,value}), close()`.
- `ChatAttachmentInput` + `.Dropzone render` + `.Trigger render` provide picker and drag-drop (see A9).

State/events: value is controlled via `value`/`onValueChange`; clearing is your job in `onSubmit` (`setValue("")`). With TokenInput leave `value` unset and clear via `tokens.setValue(new TokenFieldValue([]))`. Submission guard (`status !== "ready"`) is also yours (demos return early).

Gotchas:

- `Queue` goes as a sibling of `Shell`, inside the root. Queue rows should be text only; keep attachments in your queue model and restore them on edit [docs].
- `PromptInput.Send` is disabled/stop-capable by status: if you want Stop to cancel, pass `onStop` on the root.
- `lockInputOnRun` defaults to `true`: the textarea is disabled while `submitted|streaming`. Rezumi currently keeps the box enabled and blocks send in `submit()`; set `lockInputOnRun={false}` to type the next message while a reply streams.
- IME composition, Escape-to-stop and draft persistence are not documented. Verify Enter+IME (Rezumi guards with `isImeComposing`) before replacing.
- `PromptInput.Footer` is where the "sends X to provider" disclosure goes.

Example (AI SDK `useChat` status):

```tsx
<PromptInput
  status={status}
  value={text}
  onValueChange={setText}
  onSubmit={() => {
    if (text.trim() && status === "ready") {
      send(text.trim());
      setText("");
    }
  }}
  onStop={stopReply}
>
  <PromptInput.Shell>
    <PromptInput.Content>
      <PromptInput.TextArea placeholder={t`Ask, or describe a change…`} aria-label={t`Message the assistant`} />
    </PromptInput.Content>
    <PromptInput.Toolbar>
      <PromptInput.ToolbarStart>
        <PromptInput.Action aria-label={t`Attach a file`} tooltip={t`Attach a file`}>
          <Paperclip />
        </PromptInput.Action>
      </PromptInput.ToolbarStart>
      <PromptInput.ToolbarEnd>
        <PromptInput.Send aria-label={streaming ? t`Stop` : t`Send`} />
      </PromptInput.ToolbarEnd>
    </PromptInput.Toolbar>
  </PromptInput.Shell>
  <PromptInput.Footer>{disclosure}</PromptInput.Footer>
</PromptInput>
```

Fit for Rezumi (adopt with wrapper; high value, two composers):

- Replaces `Composer` in `assistant/conversation.tsx` and `Composer` in `career/coach-thread.tsx` (two near-duplicate hand-built textareas with Enter/Shift+Enter/IME/Escape, paperclip, send/stop morph, `field-sizing-content`).
- What maps: send/stop morph (`status` + `onStop`), autosize (`maxHeight` 240 vs coach 200 and assistant `max-h-40`), toolbar, footer disclosure, attach button + drop zone (new capability).
- What stays custom: context chips (document/posting) and uploaded-attachment chips (can go in `PromptInput.Attachments` using `ChatAttachment` rows), server-side upload before send (`client.agent.attachments.create`, send only ids), `useSessionDraft` draft persistence in coach, IME guard, Escape to stop, `uploading` disable. `layout="stacked"` (toolbar under the text) is the closest to the coach box.
- `PromptInput.Queue` (queued follow-ups) has no counterpart; Rezumi blocks send while streaming. Optional future feature.
- `PromptInput.TokenInput` could back "@" mention of documents/postings in the future; alpha RAC dependency, skip for migration.

---

## A5. Markdown (+ StreamMarkdown, CodeBlock)

Import: `import {Markdown} from "@heroui-pro/react/markdown"`. Subpath-only (see section 0 for peers).
Purpose: AI-response markdown with block-level memoisation for streaming [docs].

Anatomy: `<Markdown>{string}</Markdown>`; no dot parts.

`Markdown` props [docs]: `children: string`, `components?: Partial<react-markdown Components>`, `id?: string` (seed for memoised block keys, default generated), `className`, native `div` attrs.
[impl]: splits text with `marked.lexer` into blocks keyed by hash+occurrence; each block rendered by `react-markdown` with `remarkPlugins: [remark-gfm, remark-breaks]`. Default `code` override renders multi-line code with `CodeBlock` (language label + copy button) and inline code with `.markdown__inline-code`; your `components` merge over these (overriding `code` drops CodeBlock). No documented `skipHtml`, `urlTransform`, `rehypePlugins`, `remarkPlugins` props.

`StreamMarkdown` [d.ts/impl, not in docs API]: wraps `streamdown` with `parseIncompleteMarkdown`, props `isStreaming`, `animated` (default `{animation: "blurIn"}`), `caret` (default `"block"`, shown only while `isStreaming`), `controls` (default `false`), `components` (Streamdown components). Docs only show raw `Streamdown` usage (`import "streamdown/styles.css"`, `animated caret="block" isAnimating`) with a custom `code` renderer using `CodeBlock`.

CodeBlock [docs]: `import {CodeBlock} from "@heroui-pro/react/code-block"`; parts `CodeBlock`, `.Header`, `.Code`, `.CopyButton`. `.Code` props: `code`, `language` (default `'plaintext'`), `theme` (default `'github-light'`) [docs]; installed also has `darkTheme` (default `'github-dark'` when no `theme`) [impl]. `.CopyButton`: `code`, `aria-label` (default `'Copy code'`), `className`.

Gotchas:

- `remark-breaks` is on: single newlines become `<br>`. Rezumi today renders GFM-only, so model replies with soft line breaks will look different.
- Default behaviours Rezumi overrides for security are not available as props: images must be neutralised via `components.img`, links via `components.a` (the default component map only overrides `code`/`pre` [impl], so links get no `target="_blank"`; raw-HTML handling is react-markdown's default, which I believe escapes rather than drops it [infer], unlike `skipHtml`). Verify raw HTML handling before swapping.
- `children` must be a `string`; pass the concatenated text part.
- Styling classes: `.markdown`, `.markdown__block`, `.markdown__inline-code`. Rezumi's `typeset typeset-chat` preset would be replaced or layered.

Example (with safe overrides):

```tsx
<Markdown
  components={{
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
    img: ({ alt }) => alt ?? null,
  }}
>
  {part.text}
</Markdown>
```

Fit for Rezumi (partial; keep own renderer unless needs change):

- `assistant/markdown.tsx` `AssistantMarkdown` is `react-markdown` + `remark-gfm` + `skipHtml` + `img → alt` + `a → _blank` + table scroll wrapper (`typeset-scroll`), memoised per text. HeroUI adds block memoisation (good for long streaming replies), CodeBlock with Shiki, and copy buttons, but also `remark-breaks`, 4 new deps (+ shiki weight), and loses `skipHtml` and the table wrapper unless re-added via `components`.
- The "reply shaped by untrusted text must not load images" rule lives in `AssistantMarkdown`'s `img` override; it must be re-applied if swapped.
- Cheapest path: keep `AssistantMarkdown`, add `CodeBlock` via `components.code` only if code blocks matter (resumes rarely include code). Consider `StreamMarkdown` only if you want the animated caret; Rezumi already draws its own pulsing caret.

---

## A6. ChatTool and ChatToolGroup (deep)

Import: `import {ChatTool, ChatToolGroup, type ToolPartState} from "@heroui-pro/react/chat-tool"` (subpath-only; needs `shiki`, renders a `CodeBlock`).
Purpose: collapsible tool-call card for input, output, error, approval, grouped activity [docs].

Anatomy:

```
ChatTool                              preset (props) OR composed:
├─ ChatTool.Trigger → ChatTool.StatusIcon + your label
├─ ChatTool.Content
│  ├─ ChatTool.Args   (input?, argsText?, label)
│  ├─ ChatTool.Result (value, label)
│  ├─ ChatTool.Error  (errorText, label)           [docs: "semantic slots"]
│  └─ ChatTool.Approval [+ .ApprovalActions, .Approve, .Reject] [d.ts]
└─ ChatTool.Meta (toolCallId)           [d.ts]
ChatToolGroup (Disclosure) → .Trigger, .Content → ChatTool...
```

`ChatTool` props [docs]:

| Prop                                                                                                                                                                                                                                                                                                                                                                                                | Type                                                                                                  | Default  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| `toolName`                                                                                                                                                                                                                                                                                                                                                                                          | `string`                                                                                              | -        |
| `state`                                                                                                                                                                                                                                                                                                                                                                                             | `'input-streaming' \| 'input-available' \| 'output-available' \| 'output-error' \| 'requires-action'` | required |
| `triggerPrefix`                                                                                                                                                                                                                                                                                                                                                                                     | `ReactNode` (before `toolName`, preset mode)                                                          | -        |
| `input` / `output`                                                                                                                                                                                                                                                                                                                                                                                  | `unknown` (JSON in preset mode)                                                                       | -        |
| `argsText`                                                                                                                                                                                                                                                                                                                                                                                          | `string` (pre-formatted/partial JSON while streaming)                                                 | -        |
| `errorText`                                                                                                                                                                                                                                                                                                                                                                                         | `string` (for `output-error`)                                                                         | -        |
| `onApprove` / `onReject`                                                                                                                                                                                                                                                                                                                                                                            | `() => void` (preset buttons in `requires-action`)                                                    | -        |
| `defaultExpanded` / `isExpanded`                                                                                                                                                                                                                                                                                                                                                                    | `boolean`                                                                                             | -        |
| Also used in docs demos and typed [d.ts]: `approveLabel`, `rejectLabel` (ReactNode), `active` (shimmer; defaults to running for in-progress states), `isExpandable` (default true for custom children), `toolCallId`. Root extends HeroUI `Disclosure` props (so expansion callbacks come from Disclosure; the docs list none). `ChatToolGroup` extends `Disclosure`; `[d.ts]` also takes `active`. |

State/events: expansion via `defaultExpanded`/`isExpanded`; approval via `onApprove`/`onReject` only. No `toolCallId` in callbacks, so close over it.

Gotchas:

- AI SDK states do not match (see section 0 #6): `approval-responded` and `output-denied` have no `ToolPartState`; compute your own display state before passing in.
- Preset mode prints raw `toolName` (e.g. `read_resume`) and JSON args/result. For localised, human labels use the composable form with your own `Trans` text.
- `ChatToolGroup` has no count prop; the demo hand-writes "2 tool calls".

Example (composable, localised):

```tsx
<ChatTool state={state} isExpandable={false}>
  <ChatTool.Trigger>
    <ChatTool.StatusIcon />
    <Trans>Read the resume</Trans>
  </ChatTool.Trigger>
</ChatTool>
```

(`isExpandable={false}` is [d.ts]-only; docs show only expandable cards.)

Fit for Rezumi (partial; do not replace the approval flow blindly):

- Today: `ToolPartView` renders quiet `Trace`/`TraceLine` rows (spinner → check, "didn't finish" dimmed pending, error line) with no JSON, because args can hold user data and web-search queries. HeroUI's default card exposes args/result JSON; use only in composable, non-expandable mode.
- Approvals: `tool-approvals.tsx` shows "Send this exact query to your web search provider?" / "Save this story to Knowledge?" with Approve/Skip, gated by `disabled` per message and wired to `addToolApprovalResponse({id, approved})`. `requires-action` + `onApprove/onReject` can render the buttons but not: the exact-text preview (do via `ChatTool.Approval` children), `approval-responded` hiding, `output-denied` → "Skipped" row, or the "only on the last message" gating. Keep custom logic; at most reuse `ChatTool.Approval`/`ApprovalActions`/`Approve`/`Reject` for styling.
- `ask_user_question` (QuestionCard), `propose_edits` (ChangeSet) and `MemoryProposal` are domain UIs with no HeroUI counterpart.

---

## A7. ChainOfThought (deep)

Import: `import {ChainOfThought} from "@heroui-pro/react"`.
Purpose: collapsible reasoning/progress timeline, SDK-agnostic [docs].

Anatomy:

```
ChainOfThought                        (extends HeroUI Disclosure)
├─ ChainOfThought.Trigger             (extends Button)
└─ ChainOfThought.Content             (extends Disclosure.Content)
   └─ ChainOfThought.Steps            (div, vertical timeline)
      └─ ChainOfThought.Step (label?) (div)
```

Props [docs]: root `isStreaming` (default `false`, shimmers the trigger), `defaultExpanded`, `isExpanded`, `children`; `Step` `label?: ReactNode`, `children`. `Steps`/`Step` also native div props. Nested `ChainOfThought` inside Steps is the documented "Agent Trace" pattern (multiple collapsible blocks, custom collapsible sections via `Step label={<button …/>}`).

State/events: expansion controlled with `isExpanded`; change handler comes from Disclosure (not documented on this page). Set `isStreaming` while reasoning/tool run is in progress and change the trigger text on completion yourself (demo: "Thinking..." → "Thought for 4 seconds"; no timer built in).

Gotchas: trigger text and duration are entirely yours (translate via `Plural`/`Trans`). `isExpanded` + `isStreaming` demo keeps it open during streaming.

Example:

```tsx
<ChainOfThought isStreaming={running} defaultExpanded={false}>
  <ChainOfThought.Trigger>{running ? t`Working…` : t`Worked for ${seconds}s`}</ChainOfThought.Trigger>
  <ChainOfThought.Content>
    <ChainOfThought.Steps>
      <ChainOfThought.Step label={t`Read`}>{t`Read the resume`}</ChainOfThought.Step>
    </ChainOfThought.Steps>
  </ChainOfThought.Content>
</ChainOfThought>
```

Fit for Rezumi (optional, nice grouping):

- Rezumi renders no reasoning parts. Possible use: collapse the consecutive `Trace` rows of one assistant turn ("Read the resume", "Searched the web", "Preparing edits…") into one collapsible with `isStreaming={streaming}`; replaces the per-line spinner/shimmer with a single trigger. Pending/unfinished ("Page reading didn't finish") and error states must stay as custom step content.

---

## A8. ChatSource and ChatSources

Import: root. Purpose: citation chips and grouped lists [docs].

Anatomy:

```
ChatSource  (href, title, description, faviconUrl, sourceType, enablePreview)
├─ ChatSource.Trigger (anchor) → ChatSource.Icon (faviconUrl), ChatSource.Title
└─ ChatSource.Preview (hover card)
ChatSources (Disclosure) → .Trigger, .Content → .List → ChatSource...
```

Props [docs]: `ChatSource` `href`, `title` (default domain), `description` (enables preview), `enablePreview` (auto; set true for custom preview content), `faviconUrl`, `sourceType: 'url' | 'document'` (inferred), `children`. `.Icon`: `faviconUrl`, `children`. `ChatSources` extends `Disclosure`. Demo favicon URL uses Google's favicon service (`google.com/s2/favicons`), a third-party fetch of each domain; Rezumi's privacy stance (no user data to third parties) means consider omitting `faviconUrl`.

Gotchas: `ChatSource.Preview` needs `enablePreview` when there is no `title`/`description`; preview uses a HoverCard.

Example: `<ChatSources defaultExpanded={false}><ChatSources.Trigger>{t`Sources`}</ChatSources.Trigger><ChatSources.Content><ChatSources.List>{sources.map(s => <ChatSource key={s.url} href={s.url} title={s.title?.trim() || s.url} />)}</ChatSources.List></ChatSources.Content></ChatSources>`

Fit for Rezumi (adopt, small): replaces the "Sources" label + plain `<a>` list built from `agentWebSources(message)` in `conversation.tsx` and `career/coach-chat.tsx`. Keep `target`/`rel` behaviour (verify `Trigger` anchor props: extends native anchor, so pass `rel="noreferrer" target="_blank"`).

---

## A9. ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput

Import: root. Purpose: file previews (image/video thumbnail tile or file card with icon) and composer file picker plus drag-drop [docs].

Anatomy:

```
ChatAttachmentGroup → ChatAttachment (mediaType, mimeType, name, size, src)
   ├─ .Preview, .Icon, .Info (→ .Name, .Size), .Remove (CloseButton)
ChatAttachmentInput (accept, multiple, disabled, onFilesSelected)
├─ .Trigger  (render={(props) => <PromptInput.Action {...props} />})
└─ .Dropzone (render={(props) => <PromptInput.Shell {...props} />})
```

Props [docs]: `ChatAttachment`: `mediaType: 'audio' | 'document' | 'image' | 'unknown' | 'video'` (inferred), `mimeType`, `name`, `size` (bytes → B/KB/MB/GB), `src` (preview URL for image/video), `children`. `.Remove` extends `CloseButton`. `ChatAttachmentInput`: `accept`, `multiple` (default `true`), `disabled` (default `false`), `onFilesSelected(files: File[])`. Helpers: `inferChatAttachmentFileKind(mimeType?, name?)`, `formatChatAttachmentSize(bytes?)`.

Gotchas: size text comes from `formatChatAttachmentSize(bytes?)` (no locale argument), where Rezumi uses `formatFileSize(bytes, i18n.locale)`. Revoke `blob:` URLs for local previews (docs reminder). `src` is a URL: Rezumi attachments are server-side ids (`client.agent.attachments.create` returns `id, filename, mediaType`), not Files, so previews exist only for images you hold locally.

Fit for Rezumi (partial): fits the chips inside the composer (`RemovableChip` paperclip chips; coach shows "name · size") and the user message file chips (`paperclip` + filename). Uploads are async with ids, so use `ChatAttachmentInput.onFilesSelected` to call your upload, then render `ChatAttachment` with `name`/`mimeType` (no `src`). Locale file size formatting stays yours (render `ChatAttachment.Info` children manually).

---

## A10. ChatListView

Import: root. Purpose: thread rows for chat sidebars and pickers [docs].

Anatomy (from the working demo; the docs "Anatomy" block is flatter and inconsistent):

```
ChatListView (aria-label, items, density)
└─ ChatListView.Item (id, textValue)
   └─ ChatListView.ItemContent
      ├─ ChatListView.Icon
      ├─ ChatListView.Text → .Title, .Preview
      └─ ChatListView.Meta
```

Props [docs]: root accepts native `div` props; usage shows collection style `items` + render-function children, `density="compact"`, Item `id`, `textValue`. `[d.ts]`: extends `ListView` props (selection/collection props inherited; not covered on this page), `density?: ChatListViewVariants["density"]` (default `"comfortable"`). Item/Title/Preview/Meta extend ListView parts.

Gotchas: item action/selection APIs belong to `list-view`, not documented here; read that doc before use.

Fit for Rezumi (candidate): the assistant "history" view in `assistant-panel.tsx` (`threads` filtered by `belongsTo(document)`, delete with confirm, `formatVersionTime`) is the target. Needs per-row delete and selection which come from `list-view`; evaluate that component first.

---

## A11. ChatLoader

Import: root. Purpose: assistant-turn loading states [docs].

Parts: `ChatLoader.Dots`, `.Pulse`, `.Spinner`, `.Skeleton`, plus skeleton primitives `.SkeletonAvatar`, `.SkeletonBlock`, `.SkeletonLine`. All native `div` props [docs]; `[d.ts]`: `label?: string` and `size` on the loader variants, `children` on Skeleton.

Gotcha: `label` is the accessible text; localise it. Class names listed are skeleton-only (`.chat-loader`, `__avatar`, `__content`, `__line`).

Example: `<ChatLoader.Dots label={t`Thinking…`} />`

Fit for Rezumi (low): Rezumi shows "Thinking…" as a `TraceLine status="running"` (spinner + shimmer) when `status === "submitted"`. Same intent as `TextShimmer` + `ChatLoader.Dots`. Optional swap; keep Rezumi's `Spinner` if you want a consistent run/done icon slot with `Status`.

---

## A12. PromptSuggestion

Import: root. Purpose: starter prompts for empty chat states [docs].

Anatomy:

```
PromptSuggestion (variant="card" | default)
├─ .Header → .Title, .Description
├─ .Group (label, description)          [d.ts: section]
└─ .Items → .Item (Button)
     └─ .ItemTitle / .ItemDescription / .ItemMeta / .ItemTags / .ItemFooter
```

Props [docs]: root native `div`, `variant` (`"card"` shown; [d.ts] `PromptSuggestionVariants["variant"]`); `.Item` extends HeroUI `Button` (use `onPress`, `showEndIcon={false}` [demo]). `.Group` `label`, `description` [demo/d.ts].

Gotcha: `.Item` is a Button: clicking should call `setValue(prompt)` or send; wiring is yours. Rich items wrap `Card.Header` inside `.Item` in the cards demo.

Example:

```tsx
<PromptSuggestion variant="card">
  <PromptSuggestion.Items>
    {suggestions.map((s) => (
      <PromptSuggestion.Item key={s.label} onPress={() => setText(s.label)}>
        <PromptSuggestion.ItemTitle>{s.label}</PromptSuggestion.ItemTitle>
        <PromptSuggestion.ItemDescription>{s.hint}</PromptSuggestion.ItemDescription>
      </PromptSuggestion.Item>
    ))}
  </PromptSuggestion.Items>
</PromptSuggestion>
```

Fit for Rezumi (adopt): maps one-to-one to `suggestionsFor(document, prepare)` in `assistant-panel.tsx` (`{icon, label, hint}` entries) and `props.empty(send)` in coach-chat. Each item is `ItemTitle`=label, `ItemDescription`=hint; icons go inside the Item (wrap in your own span).

---

## A13. TextShimmer

Import: root. Purpose: shimmer for short generation/loading labels [docs].

Props: `children`, `className` (colour via `text-*`; shimmer uses `currentColor`, text at 45% alpha), supports `dom.span` render props. CSS var `--spread` sets highlight width. GPU-composited (translate only); removed under `prefers-reduced-motion: reduce` (renders solid). Classes: `.text-shimmer`, `__text`, `__highlight`.

Example: `<TextShimmer className="text-muted">{t`Thinking…`}</TextShimmer>`

Fit for Rezumi (adopt, drop-in): replaces the custom `shimmer` utility used in `trace.tsx` (`data-[status=running]:*:data-[slot=trace-title]:shimmer`, with `motion-reduce:shimmer-none`) and keeps reduced-motion behaviour. Wrap the running `TraceTitle` content with `TextShimmer`.

---

# Part B. Feedback components

## B1. NumberValue (deep)

Import: `import {NumberValue} from "@heroui-pro/react"`.
Purpose: locale-aware static number display via `Intl`-style formatting (`@internationalized/number` `NumberFormatter` [impl]) [docs].

Anatomy: `NumberValue` → optional `NumberValue.Prefix`, `NumberValue.Suffix`. Classes: `.number-value`, `__prefix`, `__value`, `__suffix`.

Props `NumberValue` [docs]:

| Prop                                                                                                 | Type                                                       | Default      |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------ |
| `value`                                                                                              | `number`                                                   | required     |
| `style`                                                                                              | `'decimal' \| 'currency' \| 'percent' \| 'unit'`           | `'decimal'`  |
| `currency`                                                                                           | `string` (required when style `currency`)                  | -            |
| `unit`                                                                                               | `string` (required when style `unit`)                      | -            |
| `notation`                                                                                           | `'standard' \| 'compact' \| 'scientific' \| 'engineering'` | `'standard'` |
| `signDisplay`                                                                                        | `'auto' \| 'always' \| 'exceptZero' \| 'never'`            | -            |
| `minimumFractionDigits`, `maximumFractionDigits`                                                     | `number`                                                   | -            |
| `locale`                                                                                             | `string` (overrides nearest I18nProvider)                  | -            |
| `formatOptions`                                                                                      | `NumberFormatOptions` (overrides the convenience props)    | -            |
| `children`                                                                                           | `ReactNode \| ((formatted: string) => ReactNode)`          | -            |
| Native `span` attrs except `children` and `style`. `Prefix`/`Suffix`: `children`, native span attrs. |

State/events: none. Docs have a "Tabular Nums" demo (right-aligned currency column); there is no tabular-nums prop.

Gotchas:

- No animation, no count-up, no digit rolling.
- Locale comes from React Aria's `I18nProvider` (`useLocale`), not Lingui. Rezumi's locale is in Lingui; pass `locale={i18n.locale}` or wrap the app in RAC `I18nProvider`.
- A render-function child gives you control of the wrapping element (the root span is not rendered with the function form).
- Percent: pass a ratio (`0.033` → "3.3%").

Example:

```tsx
const { i18n } = useLingui();
<NumberValue locale={i18n.locale} style="percent" maximumFractionDigits={0} value={heardBack / sent} />;
```

Fit for Rezumi (replace only the formatting, not `RollingNumber`):

- `components/ui/rolling-number.tsx` animates odometer digits with the Lingui locale's own digits (`i18n.number`), has a `roll` toggle, per-column stagger and an `sr-only` text. Used in homepage sections, `check-panel`, ATS checker (`checker.tsx`, `score-header.tsx`) and the GitHub stars button. NumberValue can't replace any of that.
- Useful for plain stat text where no animation is wanted, for example the `insights-view.tsx` "heard back" `Math.round(x*100)%` and median-day figures (`Plural` already localises "# days"). Use `style="percent"`.

---

## B2. TrendChip

Import: root. Purpose: up/down/neutral change chip [docs].

Anatomy: `TrendChip` → `.Prefix`, `.Indicator` (custom svg), `.Suffix`; value text is the child. `data-trend` attr on root.
Props [docs]: `trend: 'up' | 'down' | 'neutral'` (default `'up'`; success/danger/warning colours), `size: 'sm' | 'md' | 'lg'` (default `'sm'`), `variant: 'primary' | 'secondary' | 'soft' | 'tertiary'` (default `'soft'`), `children`. Wraps HeroUI `Chip`; accepts Chip props except `children`, `color`, `size`. `.Indicator` takes svg attrs; `.Prefix/.Suffix` span attrs.
Gotchas: colour is bound to `trend`; "down is good" metrics (bounce rate) need you to pick `trend` by sentiment, not direction. The text is plain: use `NumberValue`/Intl yourself.

Example: `<TrendChip trend="down" variant="tertiary">5.9%<TrendChip.Suffix>{t`vs last 7d`}</TrendChip.Suffix></TrendChip>`

Fit for Rezumi (low): no current call site found in the files checked. Candidate for future deltas (ATS score change, applications this week vs last).

---

## B3. Rating

Import: root (+ `RatingStarIcon`). Purpose: star input and read-only fractional display [docs].

Anatomy: `Rating` → `Rating.Item` (value).
Props [docs]: `Rating`: `size: 'sm'|'md'|'lg'` (default `'md'`), `value`, `defaultValue`, `onValueChange(value: number)`, `icon: ReactNode`; plus RAC `RadioGroup` props except `defaultValue/onChange/orientation/value` (`aria-label` needed, `isDisabled`, `isReadOnly`). `Rating.Item`: `value: number` (required), `children` or render function `({isActive, isPartial, partialPercent}) => ReactNode`. CSS vars `--rating-active-color` (default warning), `--rating-inactive-color`; `--rating-partial` set inline for fractions.
Gotchas: you render `Rating.Item value={1..5}` yourself. Fractional display only when `isReadOnly`. Built on a radio group (keyboard arrows).

Example: `<Rating aria-label={t`Rating`} value={v} onValueChange={setV}>{[1,2,3,4,5].map((n) => <Rating.Item key={n} value={n} />)}</Rating>`

Fit for Rezumi (none today): no rating UI in the files checked.

---

## B4. EmojiReactionButton

Import: root. Purpose: toggle chip with emoji and count [docs].

Anatomy: `EmojiReactionButton` → `.Emoji`, `.Count`. Wraps RAC `ToggleButton`.
Props [docs]: `size: 'sm'|'md'|'lg'` (default `'md'`), `isSelected`, `defaultSelected`, `onChange(isSelected)`, `isReadOnly`, `isDisabled`, `children`; all RAC ToggleButton props. Data attrs: `data-selected`, `data-readonly`.
Gotcha: you own counts and the add/remove logic (demo deletes at count 0). Emoji data comes from you (or `emoji-picker`, out of scope).
Fit for Rezumi: none (no reactions feature found).

---

## B5. PressableFeedback

Import: root. Purpose: ripple, highlight, hold-to-confirm and click-to-progress overlays for any pressable [docs].

Anatomy: `PressableFeedback` (button by default; `render`) with children `.Highlight`, `.Ripple`, `.HoldConfirm`, `.ProgressFeedback`. Usually used as a child layer inside HeroUI `Button`/`Card`/`ItemCard`, not as the root.
Props [docs]:

- Root: `isDisabled`, `children`, `className`, `render`, native button attrs.
- `.Highlight`: div attrs only (opacity overlay; `--pressable-feedback-highlight-opacity` 0.08, pressed 0.12).
- `.Ripple`: `duration` (150), `hoverOpacity` (0.08), `pressedOpacity` (0.12), `minimumPressDuration` (225), `isDisabled`, `className`, `style`.
- `.HoldConfirm`: `duration` (2000), `releaseDuration` (200), `sweep: 'right'|'left'|'down'|'up'` (`'right'`), `resetOnComplete` (true), `isDisabled`, `onComplete`, `children`, `className`. Children are the overlay content shown during the sweep (duplicate your label inside it).
- `.ProgressFeedback`: `duration` (2000), `releaseDuration` (300), `sweep`, `autoReset` (true), `resetDelay` (1500), `isDisabled`, `onComplete`, `onReset`, `children`, `className`.
  Data attrs: `data-sweep`, `data-holding`, `data-complete`, `data-progressing`.
  Gotchas: parent needs `relative overflow-hidden` (Card demo adds it). Hold-to-confirm requires holding; docs do not describe keyboard or screen-reader behaviour, so do not use it as the only confirm path for destructive actions. Ripple adds per-press animation: consider with Rezumi's motion tokens (`ENTER_CLASS`, `POP_CLASS`).
  Example: `<Button variant="danger-soft"><PressableFeedback.HoldConfirm className="bg-danger text-danger-foreground" onComplete={remove}>{t`Deleting…`}</PressableFeedback.HoldConfirm>{t`Hold to delete`}</Button>`
  Fit for Rezumi (low/optional): `useConfirm` dialogs are used for destructive actions (thread delete in `assistant-panel.tsx`). HoldConfirm is a stylistic alternative only; keep the confirm dialog for accessibility.

---

# Part C. Charts

## C0. Shared pattern, chart-tooltip, styling

All seven charts are thin wrappers over **Recharts** (`ResponsiveContainer` + the Recharts chart), imported from per-chart subpaths. They re-export Recharts parts as dot-notation members, so Recharts props apply (docs link Recharts API pages per part). Install `recharts` (not present in the repo).

Common root props [docs]: `data: Record<string, number|string>[]` (not on `PieChart`), `height` (300), `width` (`"100%"` or number/`${number}%`), `margin` (`{top:8,right:8,bottom:0,left:0}`; absent on Pie, Radar, Radial), `children`; native `div` attrs.

Shared members: `.Grid` = `CartesianGrid`, `.XAxis`, `.YAxis`, `.Tooltip` (= Recharts `Tooltip`), `.TooltipContent` (pre-built renderer: pass as `content={<X.TooltipContent />}`).

Colours: use CSS vars `--chart-1`..`--chart-4` (chart-1 lightest, 3 accent, 4 darkest [docs chart-tooltip demo]), `--accent`, `--color-success`, `--color-danger`, `--muted`. Gradient fills via an inline `<defs><linearGradient>` child.
Theming: charts apply `.area-chart .recharts-*` style rules (10px muted ticks, hidden axis lines, 0.15-opacity grid) from the library CSS. Anything that serialises the SVG (such as Rezumi's PNG export of `PipelineFlow`) loses these external rules unless inlined.

### ChartTooltip

Import: root `import {ChartTooltip} from "@heroui-pro/react"` (no recharts dependency).
Anatomy: `ChartTooltip` → `.Header`, `.Item` → `.Indicator (color)`, `.Label`, `.Value`; `ChartTooltip.Content` (auto from Recharts payload).
Props [docs]: `ChartTooltip` `active` (default `true`; `false` renders nothing), `indicator: 'dot' | 'line'` (default `'dot'`), `children`. `Content`: `active/label/payload` (from Recharts), `hideHeader` (false), `indicator`, `labelFormatter(label)`, `valueFormatter(value)`. `Indicator` `color`.
Gotcha: in custom `content` functions return `null` when `!active || !payload?.length`; read the series colour from `entry.color ?? entry.stroke ?? entry.fill` depending on the chart (area/line → `stroke`, bar → `fill`).
Example: `<AreaChart.Tooltip content={<AreaChart.TooltipContent valueFormatter={(v) => String(v)} />} />`

## C1. AreaChart: `@heroui-pro/react/area-chart`

Parts: `Area` (Recharts `Area`), `XAxis`, `YAxis`, `Grid`, `Tooltip`, `TooltipContent`. Stacked: shared `stackId` on `Area`. Sparkline: one `Area` with no axes and `margin={{top:2,right:0,bottom:0,left:0}}`. Use `dot={false}`, gradient `fill`, `type="monotone"`.

```tsx
<AreaChart data={rows} height={200}>
  <AreaChart.Grid vertical={false} />
  <AreaChart.XAxis dataKey="week" tickMargin={8} />
  <AreaChart.Area dataKey="count" dot={false} stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.1} />
  <AreaChart.Tooltip content={<AreaChart.TooltipContent />} />
</AreaChart>
```

## C2. BarChart: `@heroui-pro/react/bar-chart`

Parts: `Bar`, `XAxis`, `YAxis`, `Grid`, `Tooltip`, `TooltipContent`. Extra root prop `layout: "horizontal" | "vertical"` (default `"horizontal"`; `"vertical"` gives horizontal bars, then `XAxis type="number"` and `YAxis type="category" dataKey=…`). Stacked via `stackId`; rounding via `radius`. No `Cell` re-export (see Fit).

```tsx
<BarChart data={funnel} height={220} layout="vertical">
  <BarChart.XAxis type="number" hide />
  <BarChart.YAxis dataKey="label" type="category" width={80} />
  <BarChart.Bar dataKey="reached" barSize={14} fill="var(--chart-3)" radius={[0, 24, 24, 0]} />
  <BarChart.Tooltip content={<BarChart.TooltipContent />} />
</BarChart>
```

## C3. LineChart: `@heroui-pro/react/line-chart`

Parts: `Line`, `XAxis`, `YAxis`, `Grid`, `Tooltip`, `TooltipContent`. Dashed series via `strokeDasharray`; hidden y-axis with `domain` for portfolio-style sparklines.

```tsx
<LineChart data={rows} height={180}>
  <LineChart.Line dataKey="value" dot={false} stroke="var(--chart-3)" strokeWidth={2} type="monotone" />
</LineChart>
```

## C4. PieChart (and donut): `@heroui-pro/react/pie-chart`

Parts: `Pie`, `Cell`, `Label`, `Tooltip`, `TooltipContent`. Root has no `data`/`margin` (data goes on `Pie`). Donut = `innerRadius="68%"`, `cornerRadius`, `paddingAngle={-20}`, `strokeWidth={0}`; nested donut = two `Pie` with different radii. Colours per slice via `Cell fill`. Centre text is an absolutely positioned div over a fixed `width`+`height` chart. Every docs demo uses a hand-written `PieTooltip` (reads `entry.payload.fill`, `payload[0]` only) instead of `PieChart.TooltipContent`; the docs never show `TooltipContent` on a pie, so test it before relying on it.

```tsx
<PieChart height={220}>
  <PieChart.Pie data={d} dataKey="value" nameKey="name" innerRadius="68%" strokeWidth={0}>
    {d.map((_, i) => (
      <PieChart.Cell key={i} fill={COLORS[i % COLORS.length]} />
    ))}
  </PieChart.Pie>
</PieChart>
```

## C5. RadarChart: `@heroui-pro/react/radar-chart`

Parts: `Radar`, `Grid` (= `PolarGrid`), `AngleAxis` (`PolarAngleAxis`), `RadiusAxis` (`PolarRadiusAxis`), `Tooltip`, `TooltipContent`. Root: `data`, `height`, `width`, `children` (no margin). Multi-series via several `Radar`; dots-only via `fill="none"`.

## C6. RadialChart: `@heroui-pro/react/radial-chart`

Parts: `Bar` (= `RadialBar`), `Cell`, `AngleAxis` (`PolarAngleAxis`), `Tooltip`, `TooltipContent`. Extra root props: `barSize` (10), `innerRadius` (`"30%"`), `outerRadius` (`"80%"`), `startAngle` (90), `endAngle` (-270). Gauge/progress ring = one datum + `AngleAxis type="number" domain={[0, max]} tick={false} angleAxisId={0}` + `Bar background angleAxisId={0}`; entry `fill` goes on the datum (`{fill, name, value}`).

## C7. ComposedChart: `@heroui-pro/react/composed-chart`

Parts: `Bar`, `Line`, `Area`, `XAxis`, `YAxis`, `Grid`, `Tooltip`, `TooltipContent`. Mixed series; dual axes use `yAxisId="left"/"right"` on both `YAxis` and the series, `orientation="right"`.

Fit for Rezumi (charts; mostly keep custom):

- Charts today: `applications/components/insights-view.tsx` has no chart library. Funnel = CSS bar rows with stage colours (`getStageColor`) and stagger entrance (`starting:scale-x-0`); "applications over time" velocity = CSS bars; `PipelineFlow` = hand-built SVG flow diagram exported to PNG via `cloneNode` + injected `<style>` + canvas. Other callers: ATS score, check panel.
- Mapping: velocity bars → `BarChart` (fine; weekly buckets, tooltip, locale via formatters). Funnel → `BarChart layout="vertical"`, but per-bar stage colours need Recharts `Cell` (not re-exported on `BarChart`; import from `recharts` directly or use a render-prop on `Bar`, which is plain Recharts and not HeroUI-documented). `PipelineFlow` (Sankey-like) has no HeroUI equivalent (no Sankey) and its SVG→PNG export depends on the library's external `.bar-chart .recharts-*` CSS being inlined.
- Cost: `recharts` is a new runtime dependency for two or three simple visuals; the current CSS bars are accessible (`ol` list, text numbers) and animate with Rezumi's tokens. Recharts SVG needs its own a11y labelling. Recommend: adopt only for the over-time series (and any future trend views); keep the funnel and the flow diagram.

---

# Part D. Rezumi gap list (features HeroUI Pro AI lacks, or behaves differently)

1. **Scroll model.** HeroUI: pin-to-bottom (`initial`/`resize`). Rezumi: anchor each user turn near the top, reopen saved thread at its last user turn, hide until positioned, `content-visibility` rows, labelled "Latest" button (`message-scroller.tsx`).
2. **Tool approval flow.** HeroUI has `requires-action` + `onApprove/onReject`. Rezumi needs `approval-requested/responded`, `output-denied`, per-message gating, exact-text preview (`tool-approvals.tsx`, `ToolPartView`, `addToolApprovalResponse`).
3. **Resumable streams.** None in HeroUI. Stays in `use-assistant-chat.ts` (`resume`, `reconnectToStream`, oRPC SSE, `sendAutomaticallyWhen`). No `resuming` in `ChatStatus`.
4. **Trace semantics.** Rezumi's "pending: didn't finish" (dimmed) state, quiet i18n lines, no JSON exposure; HeroUI cards show raw tool name/JSON by default.
5. **Domain cards.** `ask_user_question` QuestionCard, `propose_edits` ChangeSet, `MemoryProposal`, `UsedChips`, "Stopped / Continue" and error-with-Retry-and-Switch-model rows: no HeroUI counterpart.
6. **Markdown safety.** `skipHtml`, `img → alt` (data-exfil guard), `a → _blank`, table scroll wrapper. HeroUI Markdown only exposes `components`; it also adds `remark-breaks`.
7. **Composer specifics.** IME-aware Enter, Escape-to-stop, session draft persistence, server-side attachment ids, context chips, disclosure copy, `lockInputOnRun` default differs (HeroUI locks input while running).
8. **Animated numbers.** `RollingNumber` (localised digits, odometer) has no HeroUI counterpart; `NumberValue` is static and uses RAC locale, not Lingui.
9. **Flow/sankey chart + PNG export.** No HeroUI equivalent; Recharts styling lives in external CSS.
10. **Locale/units.** Library file-size formatting, default English strings (CodeBlock copy label, queue labels).

## Suggested adoption order (cheap, low-risk first)

1. `TextShimmer` inside `Trace` (drop-in).
2. `PromptSuggestion` for empty states (assistant-panel, coach-chat empty).
3. `ChatSource(s)` for sources lists.
4. `ChatMessage.User/Assistant` shells (keeps `MessageView` memo).
5. `PromptInput` for both composers (biggest dedupe; keep draft/IME/upload logic).
6. `BarChart`/`AreaChart` for "applications over time" only if `recharts` is acceptable.
7. Defer: `ChatConversation` (scroll regression), `ChatTool` approvals, `Markdown`, `ChatListView` until `list-view` is reviewed.
